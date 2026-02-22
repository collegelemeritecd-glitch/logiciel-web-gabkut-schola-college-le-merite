// controllers/rh/rhDashboardController.js
const mongoose = require("mongoose");
const Salarie = require("../../models/Salarie");
const PaieMensuelle = require("../../models/PaieMensuelle");
const User = require("../../models/User");

// Helper agrégat période (sans effectif, on le calcule à part)
const buildAggregateForPeriod = (dateDebut, dateFin) => [
  {
    $match: {
      datePaie: {
        $gte: dateDebut,
        $lte: dateFin,
      },
    },
  },
  {
    $group: {
      _id: null,
      masseSalariale: { $sum: "$brut" },
      chargesPatronales: { $sum: "$chargesPatronales" },
      netAPayer: { $sum: "$netAPayer" },
    },
  },
  {
    $project: {
      _id: 0,
      masseSalariale: 1,
      chargesPatronales: 1,
      netAPayer: 1,
    },
  },
];

// GET /api/rh/dashboard-stats?mois=
exports.getDashboardStats = async (req, res, next) => {
  try {
    const { mois } = req.query;
    console.log("📊 RH dashboard stats, mois:", mois || "courant");

    const now = new Date();
    const year = now.getFullYear();

    // Si mois fourni (01-12) => filtrage mensuel, sinon mois courant
    let dateDebutMois, dateFinMois;
    if (mois) {
      const m = parseInt(mois, 10) - 1;
      dateDebutMois = new Date(year, m, 1);
      dateFinMois = new Date(year, m + 1, 0, 23, 59, 59, 999);
    } else {
      dateDebutMois = new Date(year, now.getMonth(), 1);
      dateFinMois = new Date(year, now.getMonth() + 1, 0, 23, 59, 59, 999);
    }

    // Périodes jour / semaine / mois / année
    const startOfDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      0,
      0,
      0,
      0
    );
    const endOfDay = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      23,
      59,
      59,
      999
    );

    const startOfWeek = new Date(startOfDay);
    // Lundi comme début de semaine
    const day = startOfWeek.getDay(); // 0=dimanche ... 6=samedi
    const diff = day === 0 ? -6 : 1 - day; // ramener à lundi
    startOfWeek.setDate(startOfWeek.getDate() + diff);
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    const startOfYear = new Date(year, 0, 1, 0, 0, 0, 0);
    const endOfYear = new Date(year, 11, 31, 23, 59, 59, 999);

    // Agrégations parallèles
    const [
      jourStats,
      semaineStats,
      moisStats,
      anneeStats,
      masseParMois,
      masseParService,
      effectifsParMois,
      congesGlobal,
      effectifActuel,
    ] = await Promise.all([
      PaieMensuelle.aggregate(buildAggregateForPeriod(startOfDay, endOfDay)),
      PaieMensuelle.aggregate(buildAggregateForPeriod(startOfWeek, endOfWeek)),
      PaieMensuelle.aggregate(buildAggregateForPeriod(dateDebutMois, dateFinMois)),
      PaieMensuelle.aggregate(buildAggregateForPeriod(startOfYear, endOfYear)),

      // masseParMois sur l'année
      PaieMensuelle.aggregate([
        {
          $match: {
            datePaie: {
              $gte: startOfYear,
              $lte: endOfYear,
            },
          },
        },
        {
          $group: {
            _id: { year: { $year: "$datePaie" }, month: { $month: "$datePaie" } },
            masseBrute: { $sum: "$brut" },
            net: { $sum: "$netAPayer" },
          },
        },
        {
          $sort: {
            "_id.year": 1,
            "_id.month": 1,
          },
        },
        {
          $project: {
            _id: 0,
            label: {
              $concat: [
                {
                  $toString: {
                    $cond: [
                      { $lte: ["$_id.month", 9] },
                      { $concat: ["0", { $toString: "$_id.month" }] },
                      { $toString: "$_id.month" },
                    ],
                  },
                },
                "/",
                { $toString: "$_id.year" },
              ],
            },
            masseBrute: 1,
            net: 1,
          },
        },
      ]),

      // masseParService sur le mois (ou période filtrée)
      PaieMensuelle.aggregate([
        {
          $match: {
            datePaie: {
              $gte: dateDebutMois,
              $lte: dateFinMois,
            },
          },
        },
        {
          $lookup: {
            from: "salaries",
            localField: "salarie",
            foreignField: "_id",
            as: "salarieData",
          },
        },
        { $unwind: "$salarieData" },
        {
          $group: {
            _id: "$salarieData.service",
            masseBrute: { $sum: "$brut" },
          },
        },
        {
          $project: {
            _id: 0,
            service: "$_id",
            masseBrute: 1,
          },
        },
        { $sort: { masseBrute: -1 } },
      ]),

      // effectifsParMois (entrées / sorties) sur Salarie
      Salarie.aggregate([
        {
          $facet: {
            entrees: [
              { $match: { dateEntree: { $gte: startOfYear, $lte: endOfYear } } },
              {
                $group: {
                  _id: {
                    year: { $year: "$dateEntree" },
                    month: { $month: "$dateEntree" },
                  },
                  count: { $sum: 1 },
                },
              },
              { $sort: { "_id.year": 1, "_id.month": 1 } },
            ],
            sorties: [
              {
                $match: {
                  dateSortie: { $ne: null, $gte: startOfYear, $lte: endOfYear },
                },
              },
              {
                $group: {
                  _id: {
                    year: { $year: "$dateSortie" },
                    month: { $month: "$dateSortie" },
                  },
                  count: { $sum: 1 },
                },
              },
              { $sort: { "_id.year": 1, "_id.month": 1 } },
            ],
          },
        },
        {
          $project: {
            entrees: 1,
            sorties: 1,
          },
        },
      ]).then((resArr) => {
        const data = resArr[0] || { entrees: [], sorties: [] };
        const map = new Map();

        (data.entrees || []).forEach((e) => {
          const key = `${e._id.month}/${e._id.year}`;
          if (!map.has(key)) {
            map.set(key, { label: key, entrees: 0, sorties: 0 });
          }
          map.get(key).entrees = e.count;
        });

        (data.sorties || []).forEach((s) => {
          const key = `${s._id.month}/${s._id.year}`;
          if (!map.has(key)) {
            map.set(key, { label: key, entrees: 0, sorties: 0 });
          }
          map.get(key).sorties = s.count;
        });

        return Array.from(map.values()).sort((a, b) => {
          const [m1, y1] = a.label.split("/").map((x) => parseInt(x, 10));
          const [m2, y2] = b.label.split("/").map((x) => parseInt(x, 10));
          if (y1 !== y2) return y1 - y2;
          return m1 - m2;
        });
      }),

      // congesGlobal (acquis / pris / restants sur l'effectif)
      Salarie.aggregate([
        {
          $group: {
            _id: null,
            acquis: { $sum: "$congesAcquis" },
            pris: { $sum: "$congesPris" },
            restants: { $sum: "$congesRestants" },
          },
        },
        {
          $project: {
            _id: 0,
            acquis: 1,
            pris: 1,
            restants: 1,
          },
        },
      ]),

      // effectif actuel basé sur les USERS (tous sauf élèves)
      User.countDocuments({
        role: { $ne: "eleve" },
      }),
    ]);

    // Construction des périodes : montants depuis PaieMensuelle, effectif = global users (hors élèves)
    const periodeJour = {
      masseSalariale: jourStats[0]?.masseSalariale || 0,
      chargesPatronales: jourStats[0]?.chargesPatronales || 0,
      netAPayer: jourStats[0]?.netAPayer || 0,
      effectif: effectifActuel || 0,
    };

    const periodeSemaine = {
      masseSalariale: semaineStats[0]?.masseSalariale || 0,
      chargesPatronales: semaineStats[0]?.chargesPatronales || 0,
      netAPayer: semaineStats[0]?.netAPayer || 0,
      effectif: effectifActuel || 0,
    };

    const periodeMois = {
      masseSalariale: moisStats[0]?.masseSalariale || 0,
      chargesPatronales: moisStats[0]?.chargesPatronales || 0,
      netAPayer: moisStats[0]?.netAPayer || 0,
      effectif: effectifActuel || 0,
    };

    const periodeAnnee = {
      masseSalariale: anneeStats[0]?.masseSalariale || 0,
      chargesPatronales: anneeStats[0]?.chargesPatronales || 0,
      netAPayer: anneeStats[0]?.netAPayer || 0,
      effectif: effectifActuel || 0,
    };

    console.log("RH periodeJour:", periodeJour, "effectifActuel:", effectifActuel);

    res.json({
      success: true,
      data: {
        periodeJour,
        periodeSemaine,
        periodeMois,
        periodeAnnee,
        masseParMois,
        masseParService,
        effectifsParMois,
        congesGlobal: congesGlobal[0] || {
          acquis: 0,
          pris: 0,
          restants: 0,
        },
      },
    });
  } catch (error) {
    console.error("❌ Erreur getDashboardStats RH:", error);
    next(error);
  }
};

// GET /api/rh/dernieres-paies?page=&limit=&search=&service=&statut=&mois=
exports.getDernieresPaies = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      service,
      statut,
      mois,
    } = req.query;

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = Math.min(parseInt(limit, 10) || 10, 100);

    console.log(
      "📄 RH dernières paies page:",
      pageNum,
      "search:",
      search || "-"
    );

    const filter = {};
    const now = new Date();
    const year = now.getFullYear();

    if (mois) {
      const m = parseInt(mois, 10) - 1;
      const start = new Date(year, m, 1);
      const end = new Date(year, m + 1, 0, 23, 59, 59, 999);
      filter.datePaie = { $gte: start, $lte: end };
    }

    if (search) {
      const s = search.trim();
      filter.$or = [
        { nomComplet: { $regex: s, $options: "i" } },
        { matricule: { $regex: s, $options: "i" } },
      ];
    }

    if (service) {
      filter.service = service;
    }
    if (statut) {
      filter.statut = statut;
    }

    const skip = (pageNum - 1) * limitNum;

    const [rows, total] = await Promise.all([
      PaieMensuelle.find(filter)
        .sort({ datePaie: -1 })
        .skip(skip)
        .limit(limitNum)
        .select(
          "salarie nomComplet matricule service fonction brut netAPayer statut congesAcquis congesPris congesRestants datePaie"
        )
        .lean(),
      PaieMensuelle.countDocuments(filter),
    ]);

    const salarieIds = rows
      .map((r) => r.salarie)
      .filter((id) => !!id)
      .map((id) => new mongoose.Types.ObjectId(id));

    let mapSalaries = new Map();
    if (salarieIds.length) {
      const salaries = await Salarie.find({
        _id: { $in: salarieIds },
      })
        .select("service fonction")
        .lean();

      mapSalaries = new Map(
        salaries.map((s) => [
          s._id.toString(),
          { service: s.service, fonction: s.fonction },
        ])
      );
    }

    const lignes = rows.map((r) => {
      const extra = r.salarie ? mapSalaries.get(r.salarie.toString()) : null;
      return {
        paieId: r._id,
        nomComplet: r.nomComplet || "",
        matricule: r.matricule || "",
        service: r.service || extra?.service || "",
        fonction: r.fonction || extra?.fonction || "",
        brut: r.brut || 0,
        netAPayer: r.netAPayer || 0,
        statut: r.statut || "actif",
        congesAcquis: r.congesAcquis || 0,
        congesPris: r.congesPris || 0,
        congesRestants: r.congesRestants || 0,
        dateMouvement: r.datePaie || null,
      };
    });

    res.json({
      success: true,
      data: lignes,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum) || 1,
      },
    });
  } catch (error) {
    console.error("❌ Erreur getDernieresPaies RH:", error);
    next(error);
  }
};
