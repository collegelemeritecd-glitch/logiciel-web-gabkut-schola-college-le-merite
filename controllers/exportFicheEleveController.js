/************************************************************
 📊 EXPORT FICHE ÉLÈVE CONTROLLER
 Collège Le Mérite - Gabkut Agency LMK
 
 Gestion des exports Excel et PDF pour fiches élèves
*************************************************************/

const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');
const Eleve = require('../models/Eleve');
const Paiement = require('../models/Paiement');

/**
 * 📊 EXPORT EXCEL MULTI-ONGLETS
 */
exports.exportFicheEleveExcel = async (req, res) => {
  try {
    const eleveId = req.params.id;
    const { anneeScolaire, moisFiltres } = req.query;

    const annee = anneeScolaire || '2025-2026';

    console.log(`📊 Export Excel fiche élève: ${eleveId}, année: ${annee}`);

    // Charger élève
    const eleve = await Eleve.findById(eleveId).populate('classe');
    if (!eleve) {
      return res.status(404).json({
        success: false,
        message: 'Élève introuvable'
      });
    }

    // Charger tous les paiements (sans filtre percepteur pour avoir l'historique complet)
    const paiements = await Paiement.find({
      eleveId: eleveId,
      anneeScolaire: annee
    }).sort({ datePaiement: -1 });

    console.log(`   ✅ ${paiements.length} paiements trouvés`);

    // Analyser filtres
    const moisListe = moisFiltres ? moisFiltres.split(',').filter(m => m.trim()) : [];
    const nbMoisActifs = moisListe.length;

    // Calculer situation GENERALE
    const montantTotal = eleve.montantAttendu || eleve.classe?.montantFrais || 0;
    const totalPayeGeneral = paiements.reduce((sum, p) => sum + (p.montant || 0), 0);
    const resteGeneral = Math.max(0, montantTotal - totalPayeGeneral);
    const tauxGeneral = montantTotal > 0 ? (totalPayeGeneral / montantTotal) * 100 : 0;

    // Calculer situation FILTREE
    let attenduFiltre = 0;
    let totalPayeFiltre = 0;
    let paiementsFiltres = [];

    if (nbMoisActifs > 0) {
      const mensualiteUnitaire = montantTotal / 10;
      attenduFiltre = nbMoisActifs < 10 ? mensualiteUnitaire * nbMoisActifs : montantTotal;
      
      paiementsFiltres = paiements.filter(p => moisListe.includes(p.mois));
      totalPayeFiltre = paiementsFiltres.reduce((sum, p) => sum + (p.montant || 0), 0);
    }

    const resteFiltre = Math.max(0, attenduFiltre - totalPayeFiltre);
    const tauxFiltre = attenduFiltre > 0 ? (totalPayeFiltre / attenduFiltre) * 100 : 0;

    // Créer workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Collège Le Mérite - Gabkut Agency LMK';
    workbook.created = new Date();
    workbook.company = 'Gabkut Agency LMK';

    // ========== ONGLET 1 : SITUATION GENERALE ==========
    const sheet1 = workbook.addWorksheet('Situation Générale');
    sheet1.getColumn(1).width = 30;
    sheet1.getColumn(2).width = 28;

    sheet1.mergeCells('A1:B1');
    sheet1.getCell('A1').value = 'FICHE ÉLÈVE - SITUATION GÉNÉRALE';
    sheet1.getCell('A1').font = { size: 16, bold: true, color: { argb: 'FF1F4E79' } };
    sheet1.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
    sheet1.getCell('A1').fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE7F3FF' }
    };
    sheet1.getRow(1).height = 32;

    sheet1.addRow([]);
    sheet1.addRow(['📋 IDENTITÉ', '']);
    sheet1.getRow(3).font = { bold: true, size: 13, color: { argb: 'FF3B82F6' } };
    sheet1.getRow(3).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF0F9FF' }
    };
    
    sheet1.addRow(['Nom complet', eleve.nomComplet || `${eleve.nom} ${eleve.prenom || ''}`]);
    sheet1.addRow(['Code/Matricule', eleve.code || eleve.matricule || 'N/A']);
    sheet1.addRow(['Classe', eleve.classe?.nom || 'Sans classe']);
    sheet1.addRow(['Sexe', eleve.sexe === 'M' ? 'Masculin' : eleve.sexe === 'F' ? 'Féminin' : 'N/A']);
    sheet1.addRow(['Date de naissance', eleve.dateNaissance ? new Date(eleve.dateNaissance).toLocaleDateString('fr-FR') : 'N/A']);
    sheet1.addRow(['Lieu de naissance', eleve.lieuNaissance || 'N/A']);

    sheet1.addRow([]);
    sheet1.addRow(['📞 CONTACT', '']);
    sheet1.getRow(sheet1.rowCount).font = { bold: true, size: 13, color: { argb: 'FF3B82F6' } };
    sheet1.getRow(sheet1.rowCount).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF0F9FF' }
    };
    
    sheet1.addRow(['Email', eleve.emailParent || eleve.email || 'N/A']);
    sheet1.addRow(['Téléphone', eleve.contactAppel || eleve.telephone || 'N/A']);
    sheet1.addRow(['Adresse', eleve.adresseParent || eleve.adresse || 'N/A']);

    sheet1.addRow([]);
    sheet1.addRow(['💰 SITUATION FINANCIÈRE (TOUTES MENSUALITÉS)', '']);
    sheet1.getRow(sheet1.rowCount).font = { bold: true, size: 13, color: { argb: 'FF10B981' } };
    sheet1.getRow(sheet1.rowCount).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF0FDF4' }
    };
    
    sheet1.addRow(['Année scolaire', annee]);
    sheet1.addRow(['Frais totaux attendus (USD)', montantTotal]);
    sheet1.addRow(['Total payé (USD)', totalPayeGeneral]);
    sheet1.addRow(['Reste à payer (USD)', resteGeneral]);
    sheet1.addRow(['Taux de paiement', `${tauxGeneral.toFixed(1)} %`]);

    // Style des lignes
    for (let i = 4; i <= sheet1.rowCount; i++) {
      const row = sheet1.getRow(i);
      const cellValue = row.getCell(1).value;
      if (cellValue && !cellValue.toString().startsWith('📋') && 
          !cellValue.toString().startsWith('📞') && 
          !cellValue.toString().startsWith('💰')) {
        row.getCell(1).font = { bold: true };
        row.getCell(2).alignment = { horizontal: 'right' };
      }
    }

    // ========== ONGLET 2 : SITUATION FILTREE ==========
    if (nbMoisActifs > 0) {
      const sheet2 = workbook.addWorksheet('Situation Filtrée');
      sheet2.getColumn(1).width = 30;
      sheet2.getColumn(2).width = 35;

      sheet2.mergeCells('A1:B1');
      sheet2.getCell('A1').value = 'SITUATION FILTRÉE PAR MENSUALITÉS';
      sheet2.getCell('A1').font = { size: 16, bold: true, color: { argb: 'FFF59E0B' } };
      sheet2.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
      sheet2.getCell('A1').fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFFBEB' }
      };
      sheet2.getRow(1).height = 32;

      sheet2.addRow([]);
      sheet2.addRow(['🔍 FILTRES APPLIQUÉS', '']);
      sheet2.getRow(3).font = { bold: true, size: 13, color: { argb: 'FFF59E0B' } };
      sheet2.getRow(3).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFFBEB' }
      };
      
      sheet2.addRow(['Mois inclus', `${nbMoisActifs} mois : ${moisFiltres.replace(/,/g, ', ')}`]);
      sheet2.addRow(['Calcul attendu', `(${montantTotal} USD / 10 mois) × ${nbMoisActifs} = ${attenduFiltre.toFixed(2)} USD`]);

      sheet2.addRow([]);
      sheet2.addRow(['💰 SITUATION FINANCIÈRE FILTRÉE', '']);
      sheet2.getRow(sheet2.rowCount).font = { bold: true, size: 13, color: { argb: 'FF10B981' } };
      sheet2.getRow(sheet2.rowCount).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF0FDF4' }
      };
      
      sheet2.addRow(['Frais attendus (filtré) USD', attenduFiltre.toFixed(2)]);
      sheet2.addRow(['Total payé (filtré) USD', totalPayeFiltre.toFixed(2)]);
      sheet2.addRow(['Reste à payer (filtré) USD', resteFiltre.toFixed(2)]);
      sheet2.addRow(['Taux de paiement (filtré)', `${tauxFiltre.toFixed(1)} %`]);

      for (let i = 4; i <= sheet2.rowCount; i++) {
        const row = sheet2.getRow(i);
        const cellValue = row.getCell(1).value;
        if (cellValue && !cellValue.toString().startsWith('🔍') && 
            !cellValue.toString().startsWith('💰')) {
          row.getCell(1).font = { bold: true };
          row.getCell(2).alignment = { horizontal: 'right' };
        }
      }
    }

    // ========== ONGLET 3 : HISTORIQUE COMPLET ==========
    const sheet3 = workbook.addWorksheet('Historique Complet');
    sheet3.columns = [
      { header: 'Date paiement', key: 'date', width: 16 },
      { header: 'Mois', key: 'mois', width: 14 },
      { header: 'Montant (USD)', key: 'montant', width: 16 },
      { header: 'Mode paiement', key: 'mode', width: 18 },
      { header: 'Référence', key: 'reference', width: 28 }
    ];

    const headerRow3 = sheet3.getRow(1);
    headerRow3.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow3.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' }
    };
    headerRow3.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow3.height = 24;

    if (paiements.length === 0) {
      sheet3.addRow({
        date: 'Aucun paiement',
        mois: '',
        montant: '',
        mode: '',
        reference: ''
      });
    } else {
      paiements.forEach(p => {
        sheet3.addRow({
          date: new Date(p.datePaiement).toLocaleDateString('fr-FR'),
          mois: p.mois || 'N/A',
          montant: p.montant || 0,
          mode: p.moyenPaiement || p.modePaiement || 'N/A',
          reference: p.reference || 'N/A'
        });
      });
    }

    sheet3.getColumn('montant').numFmt = '#,##0.00';
    sheet3.getColumn('montant').alignment = { horizontal: 'right' };

    // ========== ONGLET 4 : ANALYSE PAR MOIS ==========
    const sheet4 = workbook.addWorksheet('Analyse par Mois');
    sheet4.columns = [
      { header: 'Mois', key: 'mois', width: 18 },
      { header: 'Payé (USD)', key: 'paye', width: 16 },
      { header: 'Nb paiements', key: 'nb', width: 16 },
      { header: 'Statut', key: 'statut', width: 18 }
    ];

    const headerRow4 = sheet4.getRow(1);
    headerRow4.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow4.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF8B5CF6' }
    };
    headerRow4.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow4.height = 24;

    const moisList = [
      'Septembre', 'Octobre', 'Novembre', 'Décembre',
      'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin'
    ];

    const mensualite = montantTotal / 10;

    moisList.forEach(m => {
      const paiementsMois = paiements.filter(p => p.mois === m);
      const totalMois = paiementsMois.reduce((sum, p) => sum + (p.montant || 0), 0);
      const statut = totalMois >= mensualite ? '✅ Payé' : totalMois > 0 ? '⚠️ Partiel' : '❌ Non payé';
      
      sheet4.addRow({
        mois: m,
        paye: totalMois,
        nb: paiementsMois.length,
        statut
      });
    });

    sheet4.getColumn('paye').numFmt = '#,##0.00';
    sheet4.getColumn('paye').alignment = { horizontal: 'right' };
    sheet4.getColumn('nb').alignment = { horizontal: 'center' };
    sheet4.getColumn('statut').alignment = { horizontal: 'center' };

    // Sauvegarder
    const tempDir = path.join(__dirname, '../temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const safeName = `fiche-${(eleve.nomComplet || eleve.nom).replace(/[^a-zA-Z0-9]/g, '_')}-${annee}-${Date.now()}`;
    const filename = `${safeName}.xlsx`;
    const filePath = path.join(tempDir, filename);
    
    await workbook.xlsx.writeFile(filePath);

    console.log(`   ✅ Excel généré: ${filename}`);

    return res.json({
      success: true,
      message: 'Excel généré avec succès',
      fileUrl: `/api/export-fiche/download/${filename}`,
      filename
    });

  } catch (err) {
    console.error('❌ ExportFicheEleveExcel error:', err);
    res.status(500).json({
      success: false,
      message: 'Erreur export Excel: ' + err.message
    });
  }
};

/**
 * 📄 EXPORT PDF MULTI-PAGES
 */
exports.exportFicheElevePDF = async (req, res) => {
  try {
    const eleveId = req.params.id;
    const { anneeScolaire, moisFiltres } = req.query;

    const annee = anneeScolaire || '2025-2026';

    console.log(`📄 Export PDF fiche élève: ${eleveId}, année: ${annee}`);

    // Charger élève
    const eleve = await Eleve.findById(eleveId).populate('classe');
    if (!eleve) {
      return res.status(404).json({
        success: false,
        message: 'Élève introuvable'
      });
    }

    // Charger paiements
    const paiements = await Paiement.find({
      eleveId: eleveId,
      anneeScolaire: annee
    }).sort({ datePaiement: -1 });

    // Analyser filtres
    const moisListe = moisFiltres ? moisFiltres.split(',').filter(m => m.trim()) : [];
    const nbMoisActifs = moisListe.length;

    // Calculer financements
    const montantTotal = eleve.montantAttendu || eleve.classe?.montantFrais || 0;
    const totalPayeGeneral = paiements.reduce((sum, p) => sum + (p.montant || 0), 0);
    const resteGeneral = Math.max(0, montantTotal - totalPayeGeneral);

    let attenduFiltre = 0;
    let totalPayeFiltre = 0;
    if (nbMoisActifs > 0) {
      attenduFiltre = (montantTotal / 10) * nbMoisActifs;
      const paiementsFiltres = paiements.filter(p => moisListe.includes(p.mois));
      totalPayeFiltre = paiementsFiltres.reduce((sum, p) => sum + (p.montant || 0), 0);
    }
    const resteFiltre = Math.max(0, attenduFiltre - totalPayeFiltre);

    // Créer PDF
    const doc = new PDFDocument({ size: 'A4', margin: 50 });

    const tempDir = path.join(__dirname, '../temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const safeName = `fiche-${(eleve.nomComplet || eleve.nom).replace(/[^a-zA-Z0-9]/g, '_')}-${annee}-${Date.now()}`;
    const filename = `${safeName}.pdf`;
    const filePath = path.join(tempDir, filename);

    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    // Header
    doc.fontSize(20).fillColor('#3B82F6').text('FICHE ÉLÈVE', { align: 'center' });
    doc.fontSize(12).fillColor('#666').text(`Collège Le Mérite - ${annee}`, { align: 'center' });
    doc.moveDown(2);

    // Identité
    doc.fontSize(14).fillColor('#3B82F6').text('📋 IDENTITÉ');
    doc.moveDown(0.5);
    doc.fontSize(11).fillColor('#000');
    doc.text(`Nom complet: ${eleve.nomComplet || `${eleve.nom} ${eleve.prenom || ''}`}`);
    doc.text(`Code/Matricule: ${eleve.code || eleve.matricule || 'N/A'}`);
    doc.text(`Classe: ${eleve.classe?.nom || 'Sans classe'}`);
    doc.text(`Sexe: ${eleve.sexe === 'M' ? 'Masculin' : eleve.sexe === 'F' ? 'Féminin' : 'N/A'}`);
    doc.moveDown(1.5);

    // Situation générale
    doc.fontSize(14).fillColor('#10B981').text('💰 SITUATION GÉNÉRALE');
    doc.moveDown(0.5);
    doc.fontSize(11).fillColor('#000');
    doc.text(`Frais totaux: ${montantTotal.toFixed(2)} USD`);
    doc.text(`Total payé: ${totalPayeGeneral.toFixed(2)} USD`);
    doc.text(`Reste dû: ${resteGeneral.toFixed(2)} USD`);
    doc.moveDown(1.5);

    // Situation filtrée
    if (nbMoisActifs > 0) {
      doc.fontSize(14).fillColor('#F59E0B').text('🔍 SITUATION FILTRÉE');
      doc.moveDown(0.5);
      doc.fontSize(11).fillColor('#000');
      doc.text(`Mois sélectionnés: ${moisFiltres.replace(/,/g, ', ')}`);
      doc.text(`Attendu filtré: ${attenduFiltre.toFixed(2)} USD`);
      doc.text(`Payé filtré: ${totalPayeFiltre.toFixed(2)} USD`);
      doc.text(`Reste filtré: ${resteFiltre.toFixed(2)} USD`);
      doc.moveDown(1.5);
    }

    // Historique (limité à 10 lignes)
    doc.fontSize(14).fillColor('#3B82F6').text('📜 HISTORIQUE PAIEMENTS (10 derniers)');
    doc.moveDown(0.5);
    doc.fontSize(9);
    
    if (paiements.length === 0) {
      doc.text('Aucun paiement enregistré');
    } else {
      paiements.slice(0, 10).forEach(p => {
        doc.text(
          `${new Date(p.datePaiement).toLocaleDateString('fr-FR')} | ${p.mois || 'N/A'} | ${(p.montant || 0).toFixed(2)} USD | ${p.moyenPaiement || p.modePaiement || 'N/A'}`
        );
      });
    }

    doc.end();

    stream.on('finish', () => {
      console.log(`   ✅ PDF généré: ${filename}`);
      res.json({
        success: true,
        message: 'PDF généré avec succès',
        fileUrl: `/api/export-fiche/download/${filename}`,
        filename
      });
    });

  } catch (err) {
    console.error('❌ ExportFicheElevePDF error:', err);
    res.status(500).json({
      success: false,
      message: 'Erreur export PDF: ' + err.message
    });
  }
};

/**
 * 📥 TÉLÉCHARGER FICHIER
 */
exports.downloadFichier = (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(__dirname, '../temp', filename);

    console.log(`📥 Téléchargement: ${filename}`);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'Fichier introuvable'
      });
    }

    res.download(filePath, filename, (err) => {
      if (err) {
        console.error('❌ Erreur téléchargement:', err);
      } else {
        // Supprimer le fichier après téléchargement
        setTimeout(() => {
          fs.unlink(filePath, (unlinkErr) => {
            if (unlinkErr) console.error('❌ Erreur suppression fichier:', unlinkErr);
            else console.log(`   🗑️ Fichier supprimé: ${filename}`);
          });
        }, 5000);
      }
    });

  } catch (err) {
    console.error('❌ DownloadFichier error:', err);
    res.status(500).json({
      success: false,
      message: 'Erreur téléchargement: ' + err.message
    });
  }
};
