# A small text-processing example with a dictionary, sorting, and a loop.
text = "public data public schools school finance public research"
counts = {}
for word in text.split():
    counts[word] = counts.get(word, 0) + 1
for word in sorted(counts):
    print(word, counts[word])
