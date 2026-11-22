// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { useState } from "react";
import { newGame, advance, dispatch } from "../src/engine";
import GameShell from "../src/game/GameShell";
vi.mock("../src/game/city/CityView", () => ({
  default: ({
    onSelect,
    onView,
  }: {
    onSelect: (id: number) => void;
    onView: (v: "building") => void;
  }) => (
    <button
      onClick={() => {
        onSelect(5);
        onView("building");
      }}
    >
      도시 건물 선택
    </button>
  ),
}));
vi.mock("../src/game/building/BuildingView", () => ({
  default: ({ selected }: { selected: number }) => (
    <p>내부 건물 ID {selected}</p>
  ),
}));
afterEach(cleanup);
function Harness({ initialSelected = 0 }: { initialSelected?: number } = {}) {
  const [game, setGame] = useState(() => newGame(727, 1000)),
    [selected, onSelect] = useState(initialSelected);
  return (
    <GameShell
      game={game}
      act={(c) => setGame((s) => dispatch(s, c).state)}
      step={() => setGame((s) => advance(s))}
      selected={selected}
      onSelect={onSelect}
      notice=""
      saveError={false}
    >
      <LegacyForm />
      <output data-testid="game-state">{JSON.stringify(game)}</output>
      <p>운영실 시간 {game.hour}</p>
      <button onClick={() => onSelect(1)}>운영실에서 건물 변경</button>
    </GameShell>
  );
}
function LegacyForm() {
  const [value, setValue] = useState("");
  return (
    <input
      aria-label="관리 작업 입력"
      value={value}
      onChange={(e) => setValue(e.target.value)}
    />
  );
}
describe("3개 화면의 공유 상태", () => {
  it("도시를 기본 화면으로 표시하고 선택 건물을 내부에 전달한다", async () => {
    const { container } = render(<Harness />);
    expect(container.querySelector("[data-game-view=city]")).not.toBeNull();
    fireEvent.click(await screen.findByText("도시 건물 선택"));
    expect(await screen.findByText("내부 건물 ID 5")).toBeTruthy();
  });
  it("화면 변경 뒤 시간·마지막 선택을 유지하고 관리에서 내부로 복귀한다", async () => {
    render(<Harness />);
    fireEvent.click(screen.getByLabelText("1시간 진행"));
    fireEvent.click(screen.getByRole("button", { name: "관리" }));
    expect(screen.getByText("운영실 시간 1")).toBeTruthy();
    fireEvent.click(screen.getByText("운영실에서 건물 변경"));
    fireEvent.click(screen.getByRole("button", { name: "건물 내부" }));
    expect(await screen.findByText("내부 건물 ID 1")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "도시" }));
    await waitFor(() =>
      expect(screen.getByText("도시 건물 선택")).toBeTruthy(),
    );
  });
});

describe("공통 셸과 관리 복귀 회귀", () => {
  it("전역 내비게이션·HUD·화면 속성이 모든 화면에서 하나이며 관리 입력을 보존한다", async () => {
    const { container } = render(<Harness />);
    const nav = () => screen.getByRole("navigation", { name: "게임 화면" });
    const go = (name: string) =>
      fireEvent.click(within(nav()).getByRole("button", { name }));
    go("관리");
    fireEvent.change(screen.getByLabelText("관리 작업 입력"), {
      target: { value: "진행 중인 관리 작업" },
    });
    const state = screen.getByTestId("game-state").textContent;
    for (const name of ["도시", "건물 내부", "관리"]) {
      go(name);
      expect(
        screen.getAllByRole("navigation", { name: "게임 화면" }),
      ).toHaveLength(1);
      expect(screen.getAllByLabelText("일시정지")).toHaveLength(1);
      expect(container.querySelectorAll("[data-game-view]")).toHaveLength(1);
    }
    expect(
      (screen.getByLabelText("관리 작업 입력") as HTMLInputElement).value,
    ).toBe("진행 중인 관리 작업");
    expect(screen.getByTestId("game-state").textContent).toBe(state);
  });
  it("30쌍 반복 전환 후 시간·자원·주민·건물·속도·선택을 유지한다", async () => {
    const { container } = render(<Harness />);
    await screen.findByText("도시 건물 선택");
    fireEvent.click(screen.getByLabelText("2배속"));
    const before = screen.getByTestId("game-state").textContent;
    const pairs = [
      ["city", "management"],
      ["city", "building"],
      ["building", "management"],
    ] as const;
    const names = { city: "도시", building: "건물 내부", management: "관리" };
    for (const pair of pairs)
      for (let i = 0; i < 10; i++)
        for (const view of pair) {
          fireEvent.click(
            within(
              screen.getByRole("navigation", { name: "게임 화면" }),
            ).getByRole("button", { name: names[view] }),
          );
          expect(
            container
              .querySelector("[data-game-view]")
              ?.getAttribute("data-game-view"),
          ).toBe(view);
        }
    expect(screen.getByTestId("game-state").textContent).toBe(before);
    expect(screen.getByLabelText("2배속").getAttribute("aria-pressed")).toBe(
      "true",
    );
  });
  it("유효하지 않은 선택 건물은 초기 거점으로 안전하게 복귀한다", async () => {
    render(<Harness initialSelected={999} />);
    fireEvent.click(screen.getByRole("button", { name: "건물 내부" }));
    expect(await screen.findByText("내부 건물 ID 0")).toBeTruthy();
  });
  it("관리 스크롤 위치를 복귀 시 복원한다", () => {
    render(<Harness />);
    const go = (name: string) =>
      fireEvent.click(
        within(screen.getByRole("navigation", { name: "게임 화면" })).getByRole(
          "button",
          { name },
        ),
      );
    go("관리");
    const scroller = screen.getByTestId("management-scroll");
    scroller.scrollTop = 420;
    fireEvent.scroll(scroller);
    go("도시");
    scroller.scrollTop = 0;
    go("관리");
    expect(scroller.scrollTop).toBe(420);
  });
});
