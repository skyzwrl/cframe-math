import { smallestNonNegativeRoot } from "./quadratic";

export interface RayHit {
	readonly t: number;
	readonly position: Vector3;
	readonly normal: Vector3;
	readonly inside: boolean;
}

export interface SegmentClosestPoints {
	readonly pointA: Vector3;
	readonly pointB: Vector3;
	readonly s: number;
	readonly t: number;
	readonly distance: number;
}

export interface Basis {
	readonly tangent: Vector3;
	readonly bitangent: Vector3;
}

const EPSILON = 1e-12;

export function closestPointOnSegment(point: Vector3, a: Vector3, b: Vector3): Vector3 {
	const ab = b.sub(a);
	const lengthSquared = ab.Dot(ab);
	if (lengthSquared <= EPSILON) {
		return a;
	}
	return a.add(ab.mul(math.clamp(point.sub(a).Dot(ab) / lengthSquared, 0, 1)));
}

// Ericson, Real-Time Collision Detection 5.1.9, done in doubles from the components
export function closestPointsBetweenSegments(p1: Vector3, q1: Vector3, p2: Vector3, q2: Vector3): SegmentClosestPoints {
	const d1x = q1.X - p1.X;
	const d1y = q1.Y - p1.Y;
	const d1z = q1.Z - p1.Z;
	const d2x = q2.X - p2.X;
	const d2y = q2.Y - p2.Y;
	const d2z = q2.Z - p2.Z;
	const rx = p1.X - p2.X;
	const ry = p1.Y - p2.Y;
	const rz = p1.Z - p2.Z;

	const a = d1x * d1x + d1y * d1y + d1z * d1z;
	const e = d2x * d2x + d2y * d2y + d2z * d2z;
	const f = d2x * rx + d2y * ry + d2z * rz;

	let s = 0;
	let t = 0;

	if (a <= EPSILON && e <= EPSILON) {
		// both segments are points
	} else if (a <= EPSILON) {
		t = math.clamp(f / e, 0, 1);
	} else {
		const c = d1x * rx + d1y * ry + d1z * rz;
		if (e <= EPSILON) {
			s = math.clamp(-c / a, 0, 1);
		} else {
			const b = d1x * d2x + d1y * d2y + d1z * d2z;
			const denominator = a * e - b * b;

			// parallel segments have a whole range of closest pairs; any s works, the clamp below fixes t
			if (denominator > EPSILON * a * e) {
				s = math.clamp((b * f - c * e) / denominator, 0, 1);
			}
			t = (b * s + f) / e;

			if (t < 0) {
				t = 0;
				s = math.clamp(-c / a, 0, 1);
			} else if (t > 1) {
				t = 1;
				s = math.clamp((b - c) / a, 0, 1);
			}
		}
	}

	const ax = p1.X + d1x * s;
	const ay = p1.Y + d1y * s;
	const az = p1.Z + d1z * s;
	const bx = p2.X + d2x * t;
	const by = p2.Y + d2y * t;
	const bz = p2.Z + d2z * t;

	return {
		pointA: new Vector3(ax, ay, az),
		pointB: new Vector3(bx, by, bz),
		s,
		t,
		distance: math.sqrt((ax - bx) ** 2 + (ay - by) ** 2 + (az - bz) ** 2),
	};
}

export function rayPlane(
	origin: Vector3,
	direction: Vector3,
	planePoint: Vector3,
	planeNormal: Vector3,
): RayHit | undefined {
	const facing = planeNormal.Dot(direction);
	if (math.abs(facing) <= EPSILON) {
		return undefined;
	}

	const t = planeNormal.Dot(planePoint.sub(origin)) / facing;
	if (t < 0) {
		return undefined;
	}

	const normal = planeNormal.Unit;
	return {
		t,
		position: origin.add(direction.mul(t)),
		normal: facing < 0 ? normal : normal.mul(-1),
		inside: false,
	};
}

export function raySphere(origin: Vector3, direction: Vector3, center: Vector3, radius: number): RayHit | undefined {
	const mx = origin.X - center.X;
	const my = origin.Y - center.Y;
	const mz = origin.Z - center.Z;
	const c = mx * mx + my * my + mz * mz - radius * radius;

	if (c <= 0) {
		const outward = origin.sub(center);
		return {
			t: 0,
			position: origin,
			normal: outward.Magnitude > 0 ? outward.Unit : direction.Unit.mul(-1),
			inside: true,
		};
	}

	const t = smallestNonNegativeRoot(
		direction.X * direction.X + direction.Y * direction.Y + direction.Z * direction.Z,
		2 * (mx * direction.X + my * direction.Y + mz * direction.Z),
		c,
	);
	if (t === undefined) {
		return undefined;
	}

	const position = origin.add(direction.mul(t));
	return { t, position, normal: position.sub(center).div(radius), inside: false };
}

interface Slab {
	enter: number;
	exit: number;
	axis: number;
	sign: number;
}

function clipSlab(slab: Slab, origin: number, direction: number, half: number, axis: number): boolean {
	if (math.abs(direction) <= EPSILON) {
		return origin >= -half && origin <= half;
	}

	let near = (-half - origin) / direction;
	let far = (half - origin) / direction;
	let sign = -1;
	if (near > far) {
		const swap = near;
		near = far;
		far = swap;
		sign = 1;
	}

	if (near > slab.enter) {
		slab.enter = near;
		slab.axis = axis;
		slab.sign = sign;
	}
	slab.exit = math.min(slab.exit, far);
	return slab.enter <= slab.exit;
}

export function rayBox(origin: Vector3, direction: Vector3, boxCFrame: CFrame, size: Vector3): RayHit | undefined {
	const localOrigin = boxCFrame.PointToObjectSpace(origin);
	const localDirection = boxCFrame.VectorToObjectSpace(direction);
	const slab: Slab = { enter: -math.huge, exit: math.huge, axis: 0, sign: 0 };

	if (
		!clipSlab(slab, localOrigin.X, localDirection.X, size.X / 2, 0) ||
		!clipSlab(slab, localOrigin.Y, localDirection.Y, size.Y / 2, 1) ||
		!clipSlab(slab, localOrigin.Z, localDirection.Z, size.Z / 2, 2) ||
		slab.exit < 0
	) {
		return undefined;
	}

	if (slab.enter < 0) {
		return { t: 0, position: origin, normal: direction.Unit.mul(-1), inside: true };
	}

	const localNormal =
		slab.axis === 0
			? new Vector3(slab.sign, 0, 0)
			: slab.axis === 1
				? new Vector3(0, slab.sign, 0)
				: new Vector3(0, 0, slab.sign);

	return {
		t: slab.enter,
		position: origin.add(direction.mul(slab.enter)),
		normal: boxCFrame.VectorToWorldSpace(localNormal),
		inside: false,
	};
}

export function projectOnPlane(vector: Vector3, normal: Vector3): Vector3 {
	return vector.sub(normal.mul(vector.Dot(normal) / normal.Dot(normal)));
}

export function projectPointOnPlane(point: Vector3, planePoint: Vector3, normal: Vector3): Vector3 {
	return planePoint.add(projectOnPlane(point.sub(planePoint), normal));
}

export function isPointInBox(point: Vector3, boxCFrame: CFrame, size: Vector3): boolean {
	const relative = boxCFrame.PointToObjectSpace(point);
	return (
		math.abs(relative.X) <= size.X / 2 && math.abs(relative.Y) <= size.Y / 2 && math.abs(relative.Z) <= size.Z / 2
	);
}

// Duff et al. 2017, the corrected Frisvad basis: continuous everywhere, including a normal pointing down -Z
export function perpendicularBasis(normal: Vector3): Basis {
	const n = normal.Unit;
	const sign = n.Z >= 0 ? 1 : -1;
	const a = -1 / (sign + n.Z);
	const b = n.X * n.Y * a;

	return {
		tangent: new Vector3(1 + sign * n.X * n.X * a, sign * b, -sign * n.X),
		bitangent: new Vector3(b, sign + n.Y * n.Y * a, -n.Y),
	};
}
