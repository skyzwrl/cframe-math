// real roots of a x^2 + b x + c = 0 in ascending order. The second root comes from c / q rather than
// the textbook formula so it keeps its precision when a is tiny or b^2 dwarfs 4ac.
export function solveQuadratic(a: number, b: number, c: number): [number, number] | undefined {
	if (a === 0) {
		if (b === 0) {
			return undefined;
		}
		const root = -c / b;
		return [root, root];
	}

	const discriminant = b * b - 4 * a * c;
	if (discriminant < 0) {
		return undefined;
	}

	const q = -0.5 * (b + (b < 0 ? -math.sqrt(discriminant) : math.sqrt(discriminant)));
	if (q === 0) {
		return [0, 0];
	}

	const first = q / a;
	const second = c / q;
	return first < second ? [first, second] : [second, first];
}

export function smallestNonNegativeRoot(a: number, b: number, c: number): number | undefined {
	const roots = solveQuadratic(a, b, c);
	if (roots === undefined) {
		return undefined;
	}
	if (roots[0] >= 0) {
		return roots[0];
	}
	return roots[1] >= 0 ? roots[1] : undefined;
}
