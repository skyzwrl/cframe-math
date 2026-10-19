export interface SwingTwist {
	readonly swing: CFrame;
	readonly twist: CFrame;
}

export interface YawPitchRoll {
	readonly yaw: number;
	readonly pitch: number;
	readonly roll: number;
}

export interface AimLimits {
	readonly minYaw: number;
	readonly maxYaw: number;
	readonly minPitch: number;
	readonly maxPitch: number;
}

const PARALLEL_EPSILON = 1e-6;
const TAU = 2 * math.pi;

function leastAlignedAxis(vector: Vector3): Vector3 {
	const x = math.abs(vector.X);
	const y = math.abs(vector.Y);
	const z = math.abs(vector.Z);
	if (x <= y && x <= z) {
		return Vector3.xAxis;
	}
	return y <= z ? Vector3.yAxis : Vector3.zAxis;
}

function perpendicularTo(vector: Vector3): Vector3 {
	return vector.Cross(leastAlignedAxis(vector)).Unit;
}

function toQuaternion(cframe: CFrame): [number, number, number, number] {
	const [, , , m00, m01, m02, m10, m11, m12, m20, m21, m22] = cframe.GetComponents();
	const trace = m00 + m11 + m22;

	// branch on the largest diagonal term so the square root is never taken of something near zero
	if (trace > 0) {
		const s = 2 * math.sqrt(trace + 1);
		return [(m21 - m12) / s, (m02 - m20) / s, (m10 - m01) / s, s / 4];
	} else if (m00 > m11 && m00 > m22) {
		const s = 2 * math.sqrt(1 + m00 - m11 - m22);
		return [s / 4, (m01 + m10) / s, (m02 + m20) / s, (m21 - m12) / s];
	} else if (m11 > m22) {
		const s = 2 * math.sqrt(1 + m11 - m00 - m22);
		return [(m01 + m10) / s, s / 4, (m12 + m21) / s, (m02 - m20) / s];
	}
	const s = 2 * math.sqrt(1 + m22 - m00 - m11);
	return [(m02 + m20) / s, (m12 + m21) / s, s / 4, (m10 - m01) / s];
}

export function lookAlong(position: Vector3, direction: Vector3, up = Vector3.yAxis): CFrame {
	if (direction.Magnitude === 0) {
		return new CFrame(position);
	}

	const forward = direction.Unit;
	let right = forward.Cross(up);
	if (right.Magnitude <= PARALLEL_EPSILON * up.Magnitude) {
		// looking straight along up leaves the roll undefined; pick any stable right vector
		right = forward.Cross(leastAlignedAxis(forward));
	}
	right = right.Unit;

	return CFrame.fromMatrix(position, right, right.Cross(forward));
}

export function lookAt(position: Vector3, target: Vector3, up = Vector3.yAxis): CFrame {
	return lookAlong(position, target.sub(position), up);
}

export function rotationBetween(from: Vector3, to: Vector3): CFrame {
	const a = from.Unit;
	const b = to.Unit;
	const axis = a.Cross(b);
	const sine = axis.Magnitude;
	const cosine = a.Dot(b);

	if (sine < PARALLEL_EPSILON) {
		return cosine > 0 ? CFrame.identity : CFrame.fromAxisAngle(perpendicularTo(a), math.pi);
	}
	return CFrame.fromAxisAngle(axis.div(sine), math.atan2(sine, cosine));
}

export function swingTwist(rotation: CFrame, axis: Vector3): SwingTwist {
	const [x, y, z, w] = toQuaternion(rotation);
	const d = axis.Unit;
	const projection = x * d.X + y * d.Y + z * d.Z;
	const tx = d.X * projection;
	const ty = d.Y * projection;
	const tz = d.Z * projection;
	const length = math.sqrt(tx * tx + ty * ty + tz * tz + w * w);

	// a pure 180 degree swing has no twist, and its projection onto the axis collapses to zero
	const twist =
		length < 1e-9 ? CFrame.identity : new CFrame(0, 0, 0, tx / length, ty / length, tz / length, w / length);

	return { swing: rotation.Rotation.mul(twist.Inverse()), twist };
}

export function clampDirection(direction: Vector3, axis: Vector3, maxAngle: number): Vector3 {
	const d = direction.Unit;
	const a = axis.Unit;
	const cosine = d.Dot(a);
	if (cosine >= math.cos(maxAngle)) {
		return d;
	}

	let away = d.sub(a.mul(cosine));
	away = away.Magnitude < PARALLEL_EPSILON ? perpendicularTo(a) : away.Unit;
	return a.mul(math.cos(maxAngle)).add(away.mul(math.sin(maxAngle)));
}

export function clampYawPitch(direction: Vector3, base: CFrame, limits: AimLimits): Vector3 {
	const relative = base.VectorToObjectSpace(direction);
	const yaw = math.clamp(math.atan2(-relative.X, -relative.Z), limits.minYaw, limits.maxYaw);
	const pitch = math.clamp(
		math.atan2(relative.Y, math.sqrt(relative.X * relative.X + relative.Z * relative.Z)),
		limits.minPitch,
		limits.maxPitch,
	);

	const flat = math.cos(pitch);
	return base.VectorToWorldSpace(new Vector3(-math.sin(yaw) * flat, math.sin(pitch), -math.cos(yaw) * flat));
}

export function rotateAround(cframe: CFrame, pivot: Vector3, rotation: CFrame): CFrame {
	return new CFrame(pivot).mul(rotation.Rotation).mul(new CFrame(pivot.mul(-1)).mul(cframe));
}

export function mirror(cframe: CFrame, planePoint: Vector3, planeNormal: Vector3): CFrame {
	const n = planeNormal.Unit;
	const reflect = (vector: Vector3) => vector.sub(n.mul(2 * vector.Dot(n)));

	// S * R * S instead of reflecting the axes directly, which would hand back a left-handed matrix
	const rotation = cframe.Rotation;
	return CFrame.fromMatrix(
		planePoint.add(reflect(cframe.Position.sub(planePoint))),
		reflect(rotation.mul(reflect(Vector3.xAxis))),
		reflect(rotation.mul(reflect(Vector3.yAxis))),
		reflect(rotation.mul(reflect(Vector3.zAxis))),
	);
}

export function toYawPitchRoll(cframe: CFrame): YawPitchRoll {
	const [, , , m00, m01, m02, m10, m11, m12, , , m22] = cframe.GetComponents();
	const cosPitch = math.sqrt(m10 * m10 + m11 * m11);
	const pitch = math.atan2(-m12, cosPitch);

	if (cosPitch > 1e-6) {
		return { yaw: math.atan2(m02, m22), pitch, roll: math.atan2(m10, m11) };
	}

	// gimbal lock: yaw and roll spin about the same axis, so all of it goes into yaw
	return { yaw: math.atan2(m12 < 0 ? m01 : -m01, m00), pitch, roll: 0 };
}

export function fromYawPitchRoll(yaw: number, pitch: number, roll: number): CFrame {
	return CFrame.fromEulerAnglesYXZ(pitch, yaw, roll);
}

export function angleDelta(from: number, to: number): number {
	return ((to - from + math.pi) % TAU) - math.pi;
}

export function lerpAngle(from: number, to: number, alpha: number): number {
	return from + angleDelta(from, to) * alpha;
}

export function angleBetween(a: CFrame, b: CFrame): number {
	const [, , , m00, m01, m02, m10, m11, m12, m20, m21, m22] = a.ToObjectSpace(b).GetComponents();

	// atan2 of sine and cosine stays accurate near 0 and pi, where acos of the trace alone doesn't
	const sine = 0.5 * math.sqrt((m21 - m12) ** 2 + (m02 - m20) ** 2 + (m10 - m01) ** 2);
	const cosine = 0.5 * (m00 + m11 + m22 - 1);
	return math.atan2(sine, cosine);
}

export function vectorAngle(a: Vector3, b: Vector3): number {
	return math.atan2(a.Cross(b).Magnitude, a.Dot(b));
}

export function signedVectorAngle(from: Vector3, to: Vector3, axis: Vector3): number {
	const angle = vectorAngle(from, to);
	return from.Cross(to).Dot(axis) < 0 ? -angle : angle;
}
