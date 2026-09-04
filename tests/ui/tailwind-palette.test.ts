import config from "../../tailwind.config";

describe("Cosmic Tailwind palette", () => {
  test("defines every numbered cosmic and gold shade used by the UI", () => {
    const colors = config.theme?.extend?.colors as Record<string, unknown>;
    const cosmic = colors.cosmic as Record<string, string>;
    const gold = colors.gold as Record<string, string>;

    expect(Object.keys(cosmic)).toEqual(expect.arrayContaining([
      "100", "200", "300", "400", "500", "600", "700", "800", "900", "950",
    ]));
    expect(Object.keys(gold)).toEqual(expect.arrayContaining([
      "DEFAULT", "300", "400", "600",
    ]));
  });
});
