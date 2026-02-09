import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { GradingReport, ClassData } from "../types";

// Sử dụng API Key từ biến môi trường của Vite
const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);

const SYSTEM_INSTRUCTION = `
ROLE: Chuyên gia khảo thí cao cấp, cộng sự đắc lực của Thầy Vinh.
NHIỆM VỤ: Phân tích dữ liệu Sheet (TSV/CSV), chấm điểm và viết nhận xét cá nhân hóa theo ĐÚNG 5 Ý CHI TIẾT.

(Giữ nguyên các quy tắc chấm điểm và nhận xét 5 ý của bạn ở đây...)
`;

export async function processClassGrading(data: ClassData): Promise<GradingReport> {
  // 1. Khởi tạo model và cấu hình (Sửa lỗi khai báo model lơ lửng)
  const model = genAI.getGenerativeModel({
    model: "gemini-1.5-pro",
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

  // 2. Chuẩn bị dữ liệu gửi đi
  const parts: any[] = [
    { text: `BIỂU MẪU CHẤM ĐIỂM CHI TIẾT: ${data.markingGuide}` },
    { text: `--- DỮ LIỆU ĐẦU VÀO ---` },
    { text: `Dữ liệu Sheet (TSV/CSV): ${data.sheetData}` },
    { text: `Danh sách Bật Cam (Rõ): ${data.camVisibleList}` },
    { text: `Danh sách Không Bật Cam: ${data.camHiddenList}` },
    { text: `Danh sách Khen tương tác (+1đ): ${data.praiseList}` }
  ];

  if (data.testImage) {
    parts.unshift({
      inlineData: {
        mimeType: "image/jpeg",
        data: data.testImage.split(',')[1]
      }
    });
  }

  // 3. Thực thi gọi AI
  const result = await model.generateContent({ contents: [{ role: 'user', parts }] });
  const response = await result.response;
  const report: GradingReport = JSON.parse(response.text());

  // 4. Sắp xếp lại danh sách
  report.results.sort((a, b) => a.firstName.localeCompare(b.firstName, 'vi'));
  
  return report;
}