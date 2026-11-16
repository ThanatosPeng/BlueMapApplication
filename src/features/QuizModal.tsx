import { useState } from "react";
import { Alert, Button, Input, Modal, Spin, Typography } from "antd";
import { useAppStore } from "../store/useAppStore";

/**
 * AI 问答：AI 出 3 道题 → 你答 → AI 判分并写进证据。
 * 状态全在 store 里（quiz），关掉弹窗再打开还能接着答。
 */
export function QuizModal() {
  const quiz = useAppStore((s) => s.quiz);
  const finishQuiz = useAppStore((s) => s.finishQuiz);
  const cancelQuiz = useAppStore((s) => s.cancelQuiz);
  const [answers, setAnswers] = useState<Record<number, string>>({});

  if (!quiz) return null;

  const qa = quiz.questions.map((q, i) => ({ q, a: answers[i] ?? "" }));
  const answered = qa.every((item) => item.a.trim().length > 0);
  const done = quiz.score !== null;

  return (
    <Modal
      open
      title="AI 问答：检验掌握度"
      width={620}
      onCancel={cancelQuiz}
      footer={
        done ? (
          <Button onClick={cancelQuiz}>完成</Button>
        ) : (
          [
            <Button key="cancel" onClick={cancelQuiz}>
              取消
            </Button>,
            <Button
              key="submit"
              type="primary"
              disabled={!answered || quiz.grading}
              loading={quiz.grading}
              onClick={() => void finishQuiz(quiz.nodeId, qa)}
            >
              提交判分
            </Button>,
          ]
        )
      }
    >
      {quiz.busy ? (
        <div style={{ padding: "24px 0", textAlign: "center" }}>
          <Spin />
          <Typography.Paragraph type="secondary" style={{ marginTop: 10, fontSize: 12 }}>
            AI 正在出题…
          </Typography.Paragraph>
        </div>
      ) : null}

      {quiz.error ? (
        <Alert type="warning" showIcon message={quiz.error} style={{ marginBottom: 12 }} />
      ) : null}

      {quiz.questions.map((question, index) => (
        <div key={index} style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12.5, marginBottom: 6, color: "#c7d4e6" }}>
            {index + 1}. {question}
          </div>
          <Input.TextArea
            rows={3}
            value={answers[index] ?? ""}
            placeholder="用自己的话答，答不上来就写「不会」——分数是给未来的自己看的"
            onChange={(event) => setAnswers((prev) => ({ ...prev, [index]: event.target.value }))}
          />
        </div>
      ))}

      {done ? (
        <Alert
          type={quiz.score! >= 3 ? "success" : "info"}
          showIcon
          message={`AI 判定：${quiz.score} / 5`}
          description={quiz.summary}
        />
      ) : null}
    </Modal>
  );
}
