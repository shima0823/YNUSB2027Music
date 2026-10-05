import { GoogleGenAI } from '@google/genai';

const LINE_ACCESS_TOKEN = process.env.LINE_ACCESS_TOKEN;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const FIRESTORE_PROJECT_ID = "ynusb2027music";

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(200).send('OK');
  }

  try {
    const events = req.body.events;
    if (!events || events.length === 0) {
      return res.status(200).send('OK');
    }

    for (const event of events) {
      if (event.type !== 'message' || event.message.type !== 'text') continue;

      const sourceId = event.source.groupId || event.source.roomId || event.source.userId;
      const text = event.message.text.trim();

      if (text === '!todo') {
        // 直前のメッセージをFirestoreから取得
        const cacheUrl = `https://firestore.googleapis.com/v1/projects/${FIRESTORE_PROJECT_ID}/databases/(default)/documents/line_cache/${sourceId}`;
        const cacheRes = await fetch(cacheUrl);
        const cacheData = await cacheRes.json();

        if (!cacheRes.ok || !cacheData.fields || !cacheData.fields.text) {
          await replyLine(event.replyToken, '直前のメッセージが見つかりませんでした。');
          continue;
        }

        const lastMessage = cacheData.fields.text.stringValue;

        // Geminiで解析
        const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
        
        const prompt = `
以下のメッセージから、To-Do（やるべきこと）を抽出してください。
以下のJSONフォーマットのみを返してください。

{
  "title": "タスクの短いタイトル",
  "deadline": "提出期限（例: 10/15 23:59、今日中、など）",
  "actionUrl": "メッセージ内にURLがあればそれ。なければ空文字",
  "actionLabel": "リンクを開くボタンのラベル（例: フォームを開く、スプシを開く）",
  "description": "タスクの簡単な説明（1行）",
  "urgency": "high または medium または low"
}

メッセージ：
${lastMessage}
`;

        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
          config: {
            responseMimeType: "application/json",
          }
        });

        const todoData = JSON.parse(response.text);

        // Firestoreのtodosに保存
        const todosUrl = `https://firestore.googleapis.com/v1/projects/${FIRESTORE_PROJECT_ID}/databases/(default)/documents/todos`;
        const firestoreDoc = {
          fields: {
            title: { stringValue: todoData.title || "" },
            deadline: { stringValue: todoData.deadline || "" },
            actionUrl: { stringValue: todoData.actionUrl || "" },
            actionLabel: { stringValue: todoData.actionLabel || "" },
            description: { stringValue: todoData.description || "" },
            urgency: { stringValue: todoData.urgency || "medium" },
            completed: { booleanValue: false },
            createdAt: { timestampValue: new Date().toISOString() }
          }
        };

        await fetch(todosUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(firestoreDoc)
        });

        // LINEに完了を返信
        await replyLine(event.replyToken, `✅ ダッシュボードにTo-Doを追加しました！\n\n「${todoData.title}」\n(締切: ${todoData.deadline})`);

      } else {
        // !todo以外の普通のメッセージならキャッシュ（Firestore）に上書き保存
        const cacheUrl = `https://firestore.googleapis.com/v1/projects/${FIRESTORE_PROJECT_ID}/databases/(default)/documents/line_cache/${sourceId}`;
        const cacheDoc = {
          fields: {
            text: { stringValue: text },
            timestamp: { timestampValue: new Date().toISOString() }
          }
        };

        await fetch(cacheUrl, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(cacheDoc)
        });
      }
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error(error);
    res.status(500).send('Error');
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
