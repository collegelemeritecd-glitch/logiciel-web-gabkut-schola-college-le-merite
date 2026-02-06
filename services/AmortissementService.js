// services/AmortissementService.js

const Immobilisation = require('../models/comptable/Immobilisation');
const EcritureComptable = require('../models/comptable/EcritureComptable');
const Compte = require('../models/comptable/Compte');

class AmortissementService {

  /**
   * Génère les périodes mensuelles (début/fin) sur toute la durée
   */
  static _getPeriodesMensuelles(dateDebut, dureeAnnees) {
    const periodes = [];
    const start = new Date(dateDebut);
    start.setHours(0, 0, 0, 0);

    const totalMois = dureeAnnees * 12;
    let courant = new Date(start);

    for (let i = 0; i < totalMois; i++) {
      const debut = new Date(courant);
      const fin = new Date(courant.getFullYear(), courant.getMonth() + 1, 0, 23, 59, 59, 999);
      const periodeStr = `${debut.getFullYear()}-${String(debut.getMonth() + 1).padStart(2, '0')}`;
      periodes.push({ periodeStr, debut, fin });
      courant = new Date(courant.getFullYear(), courant.getMonth() + 1, 1);
    }
    return periodes;
  }

  /**
   * Plan théorique linéaire MENSUEL sur la durée totale
   * (projection complète, sans tenir compte de la date courante)
   */
  static genererPlanLineaire(immo) {
    const periodes = this._getPeriodesMensuelles(immo.dateAcquisition, immo.duree);
    const dotMensuelle = immo.valeurOrigine / (immo.duree * 12);
    const plan = [];
    let cumul = 0;

    periodes.forEach(p => {
      let dotation = parseFloat(dotMensuelle.toFixed(2));

      // Sécurité : ne jamais dépasser la valeur d'origine
      if (cumul + dotation > immo.valeurOrigine) {
        dotation = immo.valeurOrigine - cumul;
      }

      cumul += dotation;
      const vnc = Math.max(0, immo.valeurOrigine - cumul);

      plan.push({
        periode: p.periodeStr,
        dateDebut: p.debut,
        dateFin: p.fin,
        dotation,
        amortCumul: parseFloat(cumul.toFixed(2)),
        vnc: parseFloat(vnc.toFixed(2)),
        ecriture: null
      });
    });

    return plan;
  }

  /**
   * Met à jour amortCumul & vnc de l'immobilisation
   * à partir des périodes pour lesquelles une écriture existe
   */
  static _recalculerAmortCumulDepuisPlan(immo) {
    if (!immo.plan || !immo.plan.length) {
      immo.amortCumul = 0;
      immo.vnc = immo.valeurOrigine;
      return;
    }

    const periodesAmorties = immo.plan.filter(p => p.ecriture);
    let amortCumul = 0;

    if (periodesAmorties.length) {
      amortCumul = periodesAmorties.reduce((sum, p) => sum + (p.dotation || 0), 0);
    }

    if (amortCumul > immo.valeurOrigine) {
      amortCumul = immo.valeurOrigine;
    }

    immo.amortCumul = parseFloat(amortCumul.toFixed(2));
    immo.vnc = parseFloat(Math.max(0, immo.valeurOrigine - immo.amortCumul).toFixed(2));
  }

  /**
   * Génère ou régénère le plan pour une immobilisation
   */
  static async genererPlanPourImmo(immoId) {
    const immo = await Immobilisation.findById(immoId);
    if (!immo) throw new Error('Immobilisation introuvable');

    if (immo.mode !== 'lineaire') {
      throw new Error('Mode amortissement non supporté');
    }

    const plan = this.genererPlanLineaire(immo);
    immo.plan = plan;

    immo.amortCumul = 0;
    immo.vnc = immo.valeurOrigine;

    await immo.save();
    return immo;
  }

  static _periodeDansIntervalle(p, fromDate, toDate) {
    return p.dateDebut <= toDate && p.dateFin >= fromDate;
  }

  /**
   * Génère les écritures d'amortissement pour toutes les immobilisations
   * non clôturées, sur la période [from, to], UNIQUEMENT pour les
   * périodes planifiées qui n'ont pas encore d'écriture.
   */
  static async genererEcrituresPeriode(from, to, creeParUserId = null) {
    const fromDate = new Date(from);
    const toDate = new Date(to);
    fromDate.setHours(0, 0, 0, 0);
    toDate.setHours(23, 59, 59, 999);

    if (fromDate > toDate) {
      throw new Error('La date de début doit être antérieure ou égale à la date de fin.');
    }

    const immos = await Immobilisation.find({ estCloturee: false });
    const ecrituresCreees = [];

    for (const immo of immos) {
      if (!immo.plan || !immo.plan.length) continue;

      const periodesAAmortir = immo.plan.filter(p =>
        this._periodeDansIntervalle(p, fromDate, toDate) && !p.ecriture
      );

      for (const periode of periodesAAmortir) {
        if (!periode.dotation || periode.dotation <= 0) continue;

        const amortRestant = immo.valeurOrigine - (immo.amortCumul || 0);
        if (amortRestant <= 0) {
          immo.estCloturee = true;
          break;
        }

        let dotation = periode.dotation;
        if (dotation > amortRestant) {
          dotation = amortRestant;
        }

        // Récupérer les intitulés des comptes utilisés
        const comptesUtilises = await Compte.find({
          numero: { $in: [immo.compteDotation, immo.compteAmortissement] }
        }).lean();

        const compteDot = comptesUtilises.find(c => c.numero === immo.compteDotation);
        const compteAmort = comptesUtilises.find(c => c.numero === immo.compteAmortissement);

        const libDot = compteDot ? compteDot.intitule : '';
        const libAmort = compteAmort ? compteAmort.intitule : '';

        const lignes = [
          {
            compteNumero: immo.compteDotation,
            compteIntitule: libDot,
            sens: 'DEBIT',
            montant: dotation,
            libelleLigne: `Dotation amortissement ${immo.code} - ${periode.periode}`
          },
          {
            compteNumero: immo.compteAmortissement,
            compteIntitule: libAmort,
            sens: 'CREDIT',
            montant: dotation,
            libelleLigne: `Dotation amortissement ${immo.code} - ${periode.periode}`
          }
        ];

        const ecriture = new EcritureComptable({
          dateOperation: periode.dateFin, // vraie date comptable (fin de période)
          dateReporting: new Date(),      // 🔹 date technique pour les filtres actuels
          typeOperation: 'Amortissement',
          libelle: `Dotation amortissement ${immo.libelle} (${periode.periode})`,
          reference: `AMO-${immo.code}-${periode.periode}`,
          lignes,
          creePar: creeParUserId
        });

        await ecriture.save();
        periode.ecriture = ecriture._id;
        ecrituresCreees.push(ecriture);
      }

      this._recalculerAmortCumulDepuisPlan(immo);

      if (immo.vnc <= 0) {
        immo.estCloturee = true;
      }

      await immo.save();
    }

    return ecrituresCreees;
  }

  /**
   * Supprime toutes les écritures d'amortissement liées à une immobilisation
   * et nettoie les références dans le plan.
   */
  static async supprimerAmortissementsPourImmo(immoId) {
    const immo = await Immobilisation.findById(immoId);
    if (!immo) return;

    const refs = (immo.plan || [])
      .filter(p => p.ecriture)
      .map(p => p.ecriture);

    if (refs.length) {
      await EcritureComptable.deleteMany({ _id: { $in: refs } });
    }

    if (immo.plan && immo.plan.length) {
      immo.plan.forEach(p => { p.ecriture = null; });
    }

    immo.amortCumul = 0;
    immo.vnc = immo.valeurOrigine;
    immo.estCloturee = false;

    await immo.save();
  }
}

module.exports = AmortissementService;
