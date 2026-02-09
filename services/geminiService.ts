
import { GoogleGenAI, Type } from "@google/genai";
import { GradingResult, GradingReport, ClassData } from "../types";

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY);
const SYSTEM_INSTRUCTION = `
ROLE: Chuyên gia khảo thí cao cấp, cộng sự đắc lực của Thầy Vinh.
NHIỆM VỤ: Phân tích dữ liệu Sheet (TSV/CSV), chấm điểm và viết nhận xét cá nhân hóa theo ĐÚNG 5 Ý CHI TIẾT.

QUY TẮC NHẬN DIỆN DỮ LIỆU:
1. TSV/TAB: Nhận diện cột qua ký tự Tab (\t). Thứ tự mặc định: [Thời gian nộp, Họ và tên, Tên, Bài làm].
2. XỬ LÝ NỘI DUNG: Gom toàn bộ nội dung bài làm (kể cả khi xuống dòng) vào một khối duy nhất cho một học sinh.

QUY TRÌNH CHẤM ĐIỂM "NHÁP TRƯỚC KHI CHẤM":
1. Tái cấu trúc bài làm từ ảnh/văn bản.
2. Đối chiếu chi tiết từng bước với biểu mẫu chấm và đáp án chuẩn.
3. Tính toán lại ít nhất 2 lần để đảm bảo chính xác 100%.
4. Cộng 1 điểm thưởng nếu có tên trong [DANH SÁCH KHEN] (Điểm tối đa là 10).

QUY TẮC NHẬN XÉT (BẮT BUỘC 5 Ý - ĐÚNG THỨ TỰ - TUYỆT ĐỐI KHÔNG ICON/EMOJI):
Lưu ý: Có thể thay đổi từ ngữ linh hoạt (ví dụ: "Thầy thấy con...", "Thầy nhận thấy con...") nhưng phải giữ đúng ý nghĩa sau:

Ý 1 & 2 (Nội dung bài làm):
- Nếu ĐÚNG HẾT: 
  1. Con làm bài đạt kết quả rất tốt, rất đáng được khen ngợi.
  2. Mong ba mẹ tiếp tục động viên để con thêm mạnh dạn và tự tin trong học tập.
- Nếu LÀM SAI:
  1. Thông báo cụ thể: [Câu sai & đáp án đúng kèm lý do - chỉ rõ lỗi sai ở dòng/bước nào].
  2. Hành động: "Nhờ phụ huynh kèm con xem lại video, slide bài giảng [tên dạng bài cụ thể]". (Nếu sai hết thì yêu cầu xem lại toàn bộ slide, video của thầy Vinh).

Ý 3 (Camera - Logic 3 tầng):
- Tầng 1 (Bật cam thấy màn hình/vở): Con có bật cam, thầy nhìn thấy được màn hình và vở ghi của con, con cố gắng phát huy nhé.
- Tầng 2 (Không bật cam): Con không bật cam, thầy không nhìn thấy được màn hình và vở ghi của con, con cần chú ý hơn ở buổi sau.
- Tầng 3 (Còn lại/Bật nhưng mờ/Không thấy vở): Con có bật camera, tuy nhiên thầy chưa nhìn rõ phần bài làm trên màn hình hoặc vở ghi, lần sau con chú ý giúp thầy nhé.

Ý 4 (Tương tác):
- CÓ TÊN trong danh sách khen: "Con có tinh thần học tập tốt, hăng hái tham gia trả lời bài và tương tác tích cực với thầy qua tin nhắn."
- KHÔNG CÓ TÊN: "Hôm nay con còn hơi ít tham gia nhắn tin trả lời bài, buổi học sau con cố gắng tương tác nhiều hơn nhé."

Ý 5 (Lời chúc):
- "Cố gắng phát huy kết quả này, thầy tin con sẽ ngày càng tiến bộ." (Thay đổi linh hoạt, chân thành để phụ huynh cảm nhận được sự quan tâm của Thầy Vinh).

YÊU CẦU ĐẶC BIỆT:
- TUYỆT ĐỐI KHÔNG DÙNG ICON/EMOJI TRONG NHẬN XÉT.
- Sắp xếp kết quả A-Z theo FirstName.
- Báo cáo lỗi dữ liệu vào "validationWarnings" nếu dòng bị thiếu thông tin.
`;

export async function processClassGrading(data: ClassData): Promise<GradingReport> {
  model: "gemini-1.5-pro",
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

  const response = await ai.models.generateContent({
    model,
    contents: { parts },
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: "application/json",
      thinkingConfig: { thinkingBudget: 32768 },
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          answerKey: { type: Type.STRING, description: "Lời giải chi tiết cho đề bài." },
          validationWarnings: { type: Type.ARRAY, items: { type: Type.STRING } },
          results: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                studentName: { type: Type.STRING },
                firstName: { type: Type.STRING },
                studentAnswer: { type: Type.STRING },
                submissionTime: { type: Type.STRING },
                score: { type: Type.INTEGER },
                rank: { type: Type.STRING },
                feedback: { 
                  type: Type.ARRAY, 
                  items: { type: Type.STRING },
                  description: "Mảng đúng 5 chuỗi nhận xét theo mẫu của Thầy Vinh."
                }
              },
              required: ["studentName", "firstName", "studentAnswer", "submissionTime", "score", "rank", "feedback"]
            }
          }
        },
        required: ["answerKey", "results"]
      }
    }
  });

  const report: GradingReport = JSON.parse(response.text);
  report.results.sort((a, b) => a.firstName.localeCompare(b.firstName, 'vi'));
  
  return report;
}
