import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { GradingReport, ClassData } from "../types";

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);

export async function processClassGrading(data: ClassData): Promise<GradingReport> {
  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash", // Hoặc "gemini-1.5-pro"
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            answerKey: { type: SchemaType.STRING },
            results: {
              type: SchemaType.ARRAY,
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  studentName: { type: SchemaType.STRING },
                  firstName: { type: SchemaType.STRING },
                  score: { type: SchemaType.NUMBER },
                  feedback: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } }
                }
              }
            }
          }
        }
      },
      systemInstruction: "Bạn là trợ lý chấm bài của Thầy Vinh. Xuất JSON."
    });

    const parts = [{ text: `Dữ liệu: ${data.sheetData}. Đáp án: ${data.markingGuide}` }];
    const result = await model.generateContent({ contents: [{ role: 'user', parts }] });
    const text = result.response.text();
    return JSON.parse(text);
  } catch (error: any) {
    console.error("LỖI CỤ THỂ:", error);
    // Nếu vẫn lỗi 404, Thầy hãy xem Console xem nó có gợi ý 'ListModels' không
    throw new Error("AI Studio chưa kích hoạt model này cho tài khoản của bạn.");
  }
}