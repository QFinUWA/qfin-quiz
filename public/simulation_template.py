import random


def simulate() -> int:
    """
    Return a single integer each time this function is called.
    It will be executed n times to build a distribution of outcomes.

    Players submit a range [min, max] and score based on what
    proportion of your outputs land inside their range.

    Example: simulate a sum of 3 dice rolls
    """
    return random.randint(1, 6) + random.randint(1, 6) + random.randint(1, 6)
