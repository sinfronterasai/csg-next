/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import QuestionModal from "@/components/tarot/QuestionModal";
import { getSpread } from "@/lib/tarot/spreads";

describe("Tarot question control visibility contract", () => {
  const spread = getSpread("past_present_future")!;

  it("uses the explicit dark-control contract for entered text and placeholder text", () => {
    render(<QuestionModal spread={spread} onSubmit={jest.fn()} onClose={jest.fn()} />);

    const textarea = screen.getByLabelText("What’s your question?");
    expect(textarea).toHaveClass("form-dark-control");
    expect(textarea).toHaveAttribute("placeholder", "What's your question?");

    fireEvent.change(textarea, { target: { value: "What should I focus on next?" } });
    expect(textarea).toHaveValue("What should I focus on next?");
    expect(textarea).toHaveClass("form-dark-control");
  });

  it("preserves entered state and submission behavior", () => {
    const onSubmit = jest.fn();
    render(<QuestionModal spread={spread} onSubmit={onSubmit} onClose={jest.fn()} />);

    const textarea = screen.getByLabelText("What’s your question?");
    fireEvent.change(textarea, { target: { value: "A question with multiple lines\nfor reflection" } });
    fireEvent.click(screen.getByRole("button", { name: "Reveal my reading" }));

    expect(onSubmit).toHaveBeenCalledWith("A question with multiple lines\nfor reflection");
  });
});