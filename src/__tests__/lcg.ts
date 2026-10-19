const MODULUS = 4294967296;

// Numerical Recipes LCG; Random isn't available when the specs run under Lune
export function lcg(seed: number): () => number {
	let state = seed % MODULUS;
	return () => {
		state = (1664525 * state + 1013904223) % MODULUS;
		return state / MODULUS;
	};
}

export function randomVector(rng: () => number, scale = 1): Vector3 {
	return new Vector3(rng() * 2 - 1, rng() * 2 - 1, rng() * 2 - 1).mul(scale);
}

export function randomRotation(rng: () => number): CFrame {
	return CFrame.fromEulerAnglesYXZ((rng() * 2 - 1) * math.pi, (rng() * 2 - 1) * math.pi, (rng() * 2 - 1) * math.pi);
}
