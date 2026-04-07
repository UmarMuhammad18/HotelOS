from app.agents.orchestrator import run_hotel_ai
from app.scenarios import scenarios


def main():
    print("🚀 HotelOS Learning Comparison Demo\n")

    scenario = "first_visit"

    print("🟡 FIRST RUN (no learning yet)\n")
    results1 = run_hotel_ai(scenarios[scenario])
    for r in results1:
        print(r)

    print("\n\n🟢 SECOND RUN (AI learned)\n")
    results2 = run_hotel_ai(scenarios[scenario])
    for r in results2:
        print(r)


if __name__ == "__main__":
    main()