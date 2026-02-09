import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { GradingReport, ClassData } from "../types";

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);

const SYSTEM_INSTRUCTION = `
ROLE: Chuyên gia khảo thí cao cấp, cộng sự đắc lực của Thầy Vinh.
NHIỆM VỤ: Phân tích dữ liệu Sheet (TSV/CSV), chấm điểm và viết nhận xét cá nhân hóa theo ĐÚNG 5 Ý CHI TIẾT.

QUY TẮC NHẬN DIỆN DỮ LIỆU:
1. TSV/TAB: Nhận diện cột qua ký tự Tab (\\t). Thứ tự mặc định: [Thời gian nộp, Họ và tên, Tên, Bài làm].
2. XỬ LÝ NỘI DUNG: Gom toàn bộ nội dung bài làm vào một khối duy nhất cho một học sinh.

QUY TRÌNH CHẤM ĐIỂM:
1. Tái cấu trúc bài làm. 2. Đối chiếu đáp án. 3. Tính toán lại. 4. Cộng điểm thưởng.

QUY TẮC NHẬN XÉT (5 Ý - KHÔNG ICON):
Ý 1&2: Nội dung (Đúng/Sai). Ý 3: Camera (3 tầng). Ý 4: Tương tác. Ý 5: Lời chúc.
YÊU CẦU: Xuất kết quả JSON chuẩn, sắp xếp A-Z theo FirstName.
`;

export async function processClassGrading(data: ClassData): Promise<GradingReport> {
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

  const parts = [
    { text: `BIỂU MẪU CHẤM ĐIỂM CHI TIẾT: ${data.markingGuide}` },
    { text: `Dữ liệu Sheet (TSV/CSV): ${data.sheetData}` },
    { text: `Danh sách Bật Cam: ${data.camVisibleList}` },
    { text: `Danh sách Không Bật Cam: ${data.camHiddenList}` },
    { text: `Danh sách Khen tương tác: ${data.praiseList}` }
  ];

  if (data.testImage) {
    parts.unshift({
      inlineData: {
        mimeType: "image/jpeg",
        data: data.testImage.split(',')[1]
      }
    } as any);
  }

  const result = await model.generateContent({ contents: [{ role: 'user', parts }] });
  const response = await result.response;
  const report: GradingReport = JSON.parse(response.text());

  report.results.sort((a, b) => a.firstName.localeCompare(b.firstName, 'vi'));
  
  return report;
}