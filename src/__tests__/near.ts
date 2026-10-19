// these run outside the spec function, so they fail by throwing rather than through expect().

export function assertNear(actual: number, expected: number, tolerance: number, label = "value"): void {
	if (!(math.abs(actual - expected) <= tolerance)) {
		error(`${label}: expected ${expected}, got ${actual} (tolerance ${tolerance})`, 2);
	}
}

export function assertVectorNear(actual: Vector3, expected: Vector3, tolerance: number, label = "vector"): void {
	const distance = actual.sub(expected).Magnitude;
	if (!(distance <= tolerance)) {
		error(`${label}: expected ${expected}, got ${actual} (off by ${distance}, tolerance ${tolerance})`, 2);
	}
}

export function assertRotationNear(actual: CFrame, expected: CFrame, tolerance: number, label = "rotation"): void {
	const difference = math.max(
		actual.XVector.sub(expected.XVector).Magnitude,
		actual.YVector.sub(expected.YVector).Magnitude,
		actual.ZVector.sub(expected.ZVector).Magnitude,
	);
	if (!(difference <= tolerance)) {
		error(`${label}: axes differ by up to ${difference} (tolerance ${tolerance})`, 2);
	}
}

export function assertOrthonormal(cframe: CFrame, tolerance = 1e-4): void {
	const { XVector: x, YVector: y, ZVector: z } = cframe;
	assertNear(x.Magnitude, 1, tolerance, "|X|");
	assertNear(y.Magnitude, 1, tolerance, "|Y|");
	assertNear(z.Magnitude, 1, tolerance, "|Z|");
	assertNear(x.Dot(y), 0, tolerance, "X.Y");
	assertVectorNear(x.Cross(y), z, tolerance, "X x Y");
}
