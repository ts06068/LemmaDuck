"""A deliberately small reusable unit-normalization method."""

def normalize(value, scale):
    if scale <= 0:
        raise ValueError("A positive conversion scale is required")
    return value / scale
