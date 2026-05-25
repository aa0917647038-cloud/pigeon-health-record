import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import { createServer as createViteServer } from 'vite';

// Load environment variables
dotenv.config();

function createGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }

  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Maximum payload size for high-res base64 images
  app.use(express.json({ limit: '10mb' }));

  // Photo observation helper endpoint
  app.post('/api/analyze-pigeon', async (req, res) => {
    try {
      const ai = createGeminiClient();
      if (!ai) {
        return res.status(503).json({
          status: 'error',
          message: '目前尚未設定服務金鑰，暫時無法使用照片整理功能。'
        });
      }

      const { base64Image } = req.body;
      if (!base64Image) {
        return res.status(400).json({ status: 'error', message: '未提供圖片資料' });
      }

      // Isolate base64 header
      const cleanBase64 = base64Image.replace(/^data:image\/\w+;base64,/, "");

      const imagePart = {
        inlineData: {
          mimeType: "image/jpeg",
          data: cleanBase64
        }
      };

      const promptText = `
你是「每日健康觀察記錄」網站的文字整理助手。
使用者上傳的是鴿子日常觀察照片，可能包含外觀、排泄物或環號。

你的工作只有三件事：
1. 若照片中看得到環號，盡量辨識環號文字；看不清楚就回傳空字串。
2. 依照片呈現的日常觀察印象，從以下代碼中選一個最接近的記錄分類：
- 'normal'：看起來和平常差不多
- 'attention'：看起來有些不同，值得留意
- 'abnormal'：看起來差異較大，建議完整記錄後續變化
3. 產出適合寫進「每日健康觀察記錄」的簡短摘要與記錄步驟。

限制：
- 不可使用診斷、疾病、治療、獸醫、醫學、病名、處方、用藥、判定、判讀、比賽、下注、配種、價值評估等語氣或字眼。
- 不可暗示你能做專業醫療或專業判斷。
- 只能用「觀察、記錄、回看、留意、補記」這類中性描述。
- 文字口氣自然、簡單、溫和，像在協助整理每日紀錄。

請只回傳 JSON 物件，格式如下：
{
  "ringNumber": "辨識出的環號碼，如看不清楚請給空字串",
  "status": "normal | attention | abnormal",
  "statusLabel": "正常 | 需要留意 | 再觀察",
  "observationSummary": "100字內的日常觀察摘要，只描述照片看到的樣子與建議先記錄什麼",
  "observationSteps": ["3條簡短的記錄步驟，只能是拍照、補記、回看、比對這類中性動作"]
}
`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: {
          parts: [
            imagePart,
            { text: promptText }
          ]
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              ringNumber: { type: Type.STRING, description: "Detected ring number" },
              status: { type: Type.STRING, description: "One of: normal, attention, abnormal" },
              statusLabel: { type: Type.STRING, description: "Chinese status label matched" },
              observationSummary: { type: Type.STRING, description: "Daily observation summary" },
              observationSteps: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "3 simple observation record steps"
              }
            },
            required: ["ringNumber", "status", "statusLabel", "observationSummary", "observationSteps"]
          }
        }
      });

      const aiText = response.text || "{}";
      const data = JSON.parse(aiText.trim());
      return res.json({ status: 'success', ...data });

    } catch (error: any) {
      console.error('Gemini Photo Analysis Error:', error);
      return res.status(500).json({
        status: 'error',
        message: '整理失敗，請重新拍一張更清晰的照片。'
      });
    }
  });

  // Vite / static file handlers for Client-Side integration
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    // Custom SPA catch-all (Express 4.* support)
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Daily Health Observation System running on port ${PORT}`);
  });
}

// Start the fullstack pipeline
startServer();
