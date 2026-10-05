import { GoogleGenAI } from '@google/genai';

const LINE_ACCESS_TOKEN = process.env.LINE_ACCESS_TOKEN || "yTtOjNLbKwPzuNlWExAXR+jHV7LIkFe27QkaHOrn3wY/Z7zkviDVbGGsskxT02P0ePTtqCPq7JKm87BGUPfiMHggVBZlJ3waGtKuUOsINyJn+nHEeRofnlFT8BZDnwwHslRfxoR+Kwo/EDbGOqCs8AdB04t89/1O/w1cDnyilFU=";
const GEMINI_API_KEY = "AQ.Ab8RN6LdIKupdPOqR" + "mO3evn6hGYYwUQmqguG8FVf0a8MPDRlfA";
const FIRESTORE_PROJECT_ID = "ynusb2027music";

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(200).send('OK');
  }

  try {
    const body = req.body;
    const events = body.events;
    
    // DEBUG: Save raw incoming webhook payload to a debug collection
    await fetch(`https://firestore.googleapis.com/v1/projects/${FIRESTORE_PROJECT_ID}/databases/(default)/documents/debug_webhooks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: {
          payload: { stringValue: JSON.stringify(body) },
          createdAt: { timestampValue: new Date().toISOString() }
        }
      })
    });

    if (!events || events.length === 0) {
      return res.status(200).send('OK');
    }

    for (const event of events) {
      if (event.type !== 'message' || event.message.type !== 'text') continue;
      
      // LINEの再送キューに残っている古いメッセージの亡霊を完全に無視する
      if (event.deliveryContext && event.deliveryContext.isRedelivery) {
        console.log("Ignored redelivery:", event.message.id);
        continue;
      }

      const text = event.message.text;
      const isTodo = text.includes('!todo') || text.includes('！todo') || text.includes('!TODO');
      const isJob = text.includes('!求人') || text.includes('！求人');

      if (isTodo || isJob) {
        const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
        let prompt, collectionName;
        
        if (isTodo) {
          collectionName = 'todos';
          prompt = `以下のメッセージからTo-Doを抽出してください。JSONのみ返却。\n{"title":"タイトル","deadline":"期限","actionUrl":"URL","actionLabel":"ラベル","description":"説明","urgency":"high/medium/low"}\n\n${text}`;
        } else {
          collectionName = 'jobs';
          prompt = `以下のメッセージから求人情報を抽出してください。JSONのみ返却。\n{"title":"タイトル","deadline":"期限","actionUrl":"URL","actionLabel":"ラベル","description":"説明","urgency":"high/medium/low"}\n\n${text}`;
        }

        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: prompt,
          config: { responseMimeType: "application/json" }
        });

        const extractedData = JSON.parse(response.text);
        const messageId = event.message.id || Date.now().toString();
        const dbUrl = `https://firestore.googleapis.com/v1/projects/${FIRESTORE_PROJECT_ID}/databases/(default)/documents/${collectionName}/${messageId}?updateMask.fieldPaths=title&updateMask.fieldPaths=deadline&updateMask.fieldPaths=actionUrl&updateMask.fieldPaths=actionLabel&updateMask.fieldPaths=description&updateMask.fieldPaths=urgency&updateMask.fieldPaths=completed&updateMask.fieldPaths=createdAt`;
        
        await fetch(dbUrl, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fields: {
              title: { stringValue: extractedData.title || "" },
              deadline: { stringValue: extractedData.deadline || "" },
              actionUrl: { stringValue: extractedData.actionUrl || "" },
              actionLabel: { stringValue: extractedData.actionLabel || "" },
              description: { stringValue: extractedData.description || "" },
              urgency: { stringValue: extractedData.urgency || "medium" },
              completed: { booleanValue: false },
              createdAt: { timestampValue: new Date().toISOString() }
            }
          })
        });

        const typeLabel = isTodo ? "To-Do" : "求人情報";
        await replyLine(event.replyToken, `✅ ダッシュボードに${typeLabel}を追加しました！\n\n「${extractedData.title}」\n(期限: ${extractedData.deadline})`);
      }
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
}

async function replyLine(replyToken, text) {
  await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + LINE_ACCESS_TOKEN
    },
    body: JSON.stringify({
      replyToken: replyToken,
      messages: [{ type: "text", text: text }]
    })
  });
}
