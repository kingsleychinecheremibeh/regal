import { faq } from "@/lib/site-content";

export function FaqList() {
  return (
    <div className="faq">
      {faq.map(([question, answer]) => (
        <details key={question}>
          <summary>{question}</summary>
          <div>{answer}</div>
        </details>
      ))}
    </div>
  );
}
