import { perpendicularBasis } from "./geometry";

export type Rng = () => number;

export function randomOnSphere(rng: Rng = math.random): Vector3 {
	// z uniform in [-1, 1] gives equal area per band (Archimedes' hat-box theorem)
	const z = 2 * rng() - 1;
	const angle = 2 * math.pi * rng();
	const ring = math.sqrt(math.max(0, 1 - z * z));
	return new Vector3(ring * math.cos(angle), ring * math.sin(angle), z);
}

export function randomInSphere(center: Vector3, radius: number, rng: Rng = math.random): Vector3 {
	// volume grows with r^3, so the radius needs a cube root to keep density even
	return center.add(randomOnSphere(rng).mul(radius * rng() ** (1 / 3)));
}

export function randomInDisk(center: Vector3, normal: Vector3, radius: number, rng: Rng = math.random): Vector3 {
	return randomInAnnulus(center, normal, 0, radius, rng);
}

export function randomInAnnulus(
	center: Vector3,
	normal: Vector3,
	innerRadius: number,
	outerRadius: number,
	rng: Rng = math.random,
): Vector3 {
	const inner = innerRadius * innerRadius;
	const distance = math.sqrt(inner + rng() * (outerRadius * outerRadius - inner));
	const angle = 2 * math.pi * rng();
	const { tangent, bitangent } = perpendicularBasis(normal);
	return center.add(tangent.mul(distance * math.cos(angle))).add(bitangent.mul(distance * math.sin(angle)));
}

export function randomInBox(cframe: CFrame, size: Vector3, rng: Rng = math.random): Vector3 {
	return cframe.PointToWorldSpace(
		new Vector3((rng() - 0.5) * size.X, (rng() - 0.5) * size.Y, (rng() - 0.5) * size.Z),
	);
}

export function randomInCone(direction: Vector3, halfAngle: number, rng: Rng = math.random): Vector3 {
	// uniform over the spherical cap, so shots don't bunch up in the middle the way random angles do
	const cosine = 1 - rng() * (1 - math.cos(halfAngle));
	const sine = math.sqrt(math.max(0, 1 - cosine * cosine));
	const angle = 2 * math.pi * rng();
	const forward = direction.Unit;
	const { tangent, bitangent } = perpendicularBasis(forward);
	return forward
		.mul(cosine)
		.add(tangent.mul(sine * math.cos(angle)))
		.add(bitangent.mul(sine * math.sin(angle)));
}
