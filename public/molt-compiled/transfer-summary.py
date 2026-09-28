# Observed Austin ISD charter transfers from the original five-year report.
# Source: CharterCostTracker, Austin ISD fiscal impact summary (May 2024 inputs).
years = ["2019-20", "2020-21", "2021-22", "2022-23", "2023-24"]
transfers = [15454, 15798, 15222, 15045, 12636]
enrollment = [80911, 74871, 74602, 73384, 72830]

print("Austin ISD: observed charter transfers")
total = 0
for i in range(len(years)):
    # Round to the nearest tenth of a percent using integer arithmetic.
    tenths = (transfers[i] * 1000 + enrollment[i] // 2) // enrollment[i]
    print(years[i], transfers[i], str(tenths // 10) + "." + str(tenths % 10) + "%")
    total += transfers[i]
print("Sum of annual counts:", total)
print("Annual counts can include the same student in multiple years.")
