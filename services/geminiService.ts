import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { GradingReport, ClassData } from "../types";

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);

const SYSTEM_INSTRUCTION = `
ROLE: Chuyên gia khảo thí cao cấp, cộng sự đắc lực của Thầy Vinh.
NHIỆM VỤ: Phân tích dữ liệu Sheet (TSV/CSV), chấm điểm và viết nhận xét cá nhân hóa theo ĐÚNG 5 Ý CHI TIẾT.
... (giữ nguyên phần instruction dài của bạn) ...
`;

export async function processClassGrading(data: ClassData): Promise<GradingReport> {
  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash-latest", // Thay đổi quan trọng nhất
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          answerKey: { type: SchemaType.STRING },
          validationWarnings: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
          results: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                studentName: { type: SchemaType.STRING },
                firstName: { type: SchemaType.STRING },
                studentAnswer: { type: SchemaType.STRING },
                submissionTime: { type: SchemaType.STRING },
                score: { type: SchemaType.NUMBER },
                rank: { type: SchemaType.STRING },
                feedback: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } }
              },
              required: ["studentName", "firstName", "studentAnswer", "submissionTime", "score", "rank", "feedback"]
            }
          }
        },
        required: ["answerKey", "results"]
      }
    },
    systemInstruction: SYSTEM_INSTRUCTION,
  });

  const parts = [
    { text: `BIỂU MẪU CHẤM ĐIỂM CHI TIẾT: ${data.markingGuide}` },
    { text: `Dữ liệu Sheet (TSV/CSV): ${data.sheetData}` },
    { text: `Danh sách Bật Cam: ${data.camVisibleList}` },
    { text: `Danh sách Không Bật Cam: ${data.camHiddenList}` },
    { text: `Danh sách Khen tương tác: ${data.praiseList}` }
  ];

  if (data.testImage) {
    try {
      parts.unshift({
        inlineData: {
          mimeType: "image/jpeg",
          data: data.testImage.split(',')[1]
        }
      } as any);
    } catch (e) { console.error("Lỗi ảnh:", e); }
  }

  try {
    const result = await model.generateContent({ contents: [{ role: 'user', parts }] });
    const response = await result.response;
    const text = response.text();
    const report: GradingReport = JSON.parse(text);
    report.results.sort((a, b) => a.firstName.localeCompare(b.firstName, 'vi'));
    return report;
  } catch (error: any) {
    console.error("Lỗi chi tiết từ Google:", error);
    throw new Error(error.message || "Lỗi kết nối AI");
  }
}