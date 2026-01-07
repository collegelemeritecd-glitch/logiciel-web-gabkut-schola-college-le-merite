/************************************************************
 📌 Gabkut-Schola – IA Engine
 Version PRO MAX 2026 — Compatible Communication Fusion
 Analyse des messages, pièces jointes, vidéos, comportements,
 priorisation des notifications, score sécurité IA, etc.
 *************************************************************/

module.exports = {
    analyseMessage: async (content) => {
        if (!content) return { score: 0, tags: [], alert: false };

        const text = content.toLowerCase();

        let score = 0;
        let tags = [];
        let alert = false;

        // Analyse sentiment
        if (text.includes("merci") || text.includes("bien") || text.includes("ok")) {
            score += 1;
            tags.push("positif");
        }

        if (text.includes("urgent") || text.includes("problème") || text.includes("erreur")) {
            score += 2;
            tags.push("urgent");
        }

        // Analyse de sécurité
        if (text.includes("mot de passe") || text.includes("mdp") || text.includes("code secret")) {
            alert = true;
            tags.push("sensible");
        }

        return { score, tags, alert };
    },

    analyseFichier: async (file) => {
        if (!file) return { type: "unknown", danger: false };

        const ext = file.split(".").pop().toLowerCase();

        const videoExt = ["mp4", "webm", "avi", "mov"];
        const audioExt = ["mp3", "wav", "ogg"];
        const imageExt = ["png", "jpg", "jpeg", "gif"];
        const docExt = ["pdf", "docx", "xlsx", "pptx"];

        if (videoExt.includes(ext)) return { type: "video", danger: false };
        if (audioExt.includes(ext)) return { type: "audio", danger: false };
        if (imageExt.includes(ext)) return { type: "image", danger: false };
        if (docExt.includes(ext)) return { type: "document", danger: false };

        return { type: "unknown", danger: false };
    },

    evaluationConversation: async (messages) => {
        if (!messages || messages.length === 0)
            return { importance: "faible", risques: [] };

        let risques = [];
        let urgentCount = 0;

        messages.forEach(msg => {
            const txt = (msg.content || "").toLowerCase();
            if (txt.includes("urgent")) urgentCount++;
            if (txt.includes("erreur")) risques.push("erreur détectée");
        });

        let importance = "faible";
        if (urgentCount >= 3) importance = "critique";
        else if (urgentCount >= 1) importance = "moyenne";

        return { importance, risques };
    }
};
