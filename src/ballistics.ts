export type Arc = "low" | "high";

export interface LaunchSolution {
	readonly velocity: Vector3;
	readonly time: number;
}

export interface Apex {
	readonly position: Vector3;
	readonly time: number;
}

export const DEFAULT_GRAVITY = new Vector3(0, -196.2, 0);

export function solveLaunch(
	origin: Vector3,
	target: Vector3,
	speed: number,
	gravity = DEFAULT_GRAVITY,
	arc: Arc = "low",
): LaunchSolution | undefined {
	const dx = target.X - origin.X;
	const dy = target.Y - origin.Y;
	const dz = target.Z - origin.Z;
	const gx = gravity.X;
	const gy = gravity.Y;
	const gz = gravity.Z;

	const distanceSquared = dx * dx + dy * dy + dz * dz;
	if (speed <= 0 || distanceSquared === 0) {
		return undefined;
	}

	const gravitySquared = gx * gx + gy * gy + gz * gz;
	let time: number;

	if (gravitySquared === 0) {
		time = math.sqrt(distanceSquared) / speed;
	} else {
		// |d - g t^2 / 2| = speed * t squared is a quadratic in u = t^2:
		// (g.g / 4) u^2 - (speed^2 + d.g) u + d.d = 0
		const b = speed * speed + dx * gx + dy * gy + dz * gz;
		const discriminant = b * b - gravitySquared * distanceSquared;
		if (b <= 0 || discriminant < 0) {
			return undefined;
		}

		// the short flight uses c / q instead of (b - root) / a, which cancels badly near max range
		const root = math.sqrt(discriminant);
		const u = arc === "low" ? (2 * distanceSquared) / (b + root) : (2 * (b + root)) / gravitySquared;
		time = math.sqrt(u);
	}

	const half = time / 2;
	return {
		velocity: new Vector3(dx / time - gx * half, dy / time - gy * half, dz / time - gz * half),
		time,
	};
}

export function launchVelocityForTime(
	origin: Vector3,
	target: Vector3,
	time: number,
	gravity = DEFAULT_GRAVITY,
): Vector3 {
	if (time <= 0) {
		error("launchVelocityForTime: time must be positive", 2);
	}

	const half = time / 2;
	return new Vector3(
		(target.X - origin.X) / time - gravity.X * half,
		(target.Y - origin.Y) / time - gravity.Y * half,
		(target.Z - origin.Z) / time - gravity.Z * half,
	);
}

export function maxRange(speed: number, gravity = DEFAULT_GRAVITY, heightAboveTarget = 0): number {
	const g = gravity.Magnitude;
	if (g === 0) {
		return math.huge;
	}

	const reach = speed * speed + 2 * g * heightAboveTarget;
	return reach > 0 ? (speed / g) * math.sqrt(reach) : 0;
}

export function positionAt(origin: Vector3, velocity: Vector3, time: number, gravity = DEFAULT_GRAVITY): Vector3 {
	const half = (time * time) / 2;
	return new Vector3(
		origin.X + velocity.X * time + gravity.X * half,
		origin.Y + velocity.Y * time + gravity.Y * half,
		origin.Z + velocity.Z * time + gravity.Z * half,
	);
}

export function velocityAt(velocity: Vector3, time: number, gravity = DEFAULT_GRAVITY): Vector3 {
	return new Vector3(velocity.X + gravity.X * time, velocity.Y + gravity.Y * time, velocity.Z + gravity.Z * time);
}

export function apex(origin: Vector3, velocity: Vector3, gravity = DEFAULT_GRAVITY): Apex {
	const gravitySquared = gravity.X * gravity.X + gravity.Y * gravity.Y + gravity.Z * gravity.Z;
	if (gravitySquared === 0) {
		return { position: origin, time: 0 };
	}

	const along = velocity.X * gravity.X + velocity.Y * gravity.Y + velocity.Z * gravity.Z;
	const time = math.max(0, -along / gravitySquared);
	return { position: positionAt(origin, velocity, time, gravity), time };
}
