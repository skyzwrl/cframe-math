import { Arc, DEFAULT_GRAVITY, solveLaunch } from "./ballistics";
import { smallestNonNegativeRoot } from "./quadratic";

export interface Intercept {
	readonly time: number;
	readonly position: Vector3;
	readonly direction: Vector3;
}

export interface BallisticIntercept {
	readonly time: number;
	readonly position: Vector3;
	readonly velocity: Vector3;
}

export function interceptLinear(
	shooter: Vector3,
	speed: number,
	targetPosition: Vector3,
	targetVelocity: Vector3,
): Intercept | undefined {
	const dx = targetPosition.X - shooter.X;
	const dy = targetPosition.Y - shooter.Y;
	const dz = targetPosition.Z - shooter.Z;
	const vx = targetVelocity.X;
	const vy = targetVelocity.Y;
	const vz = targetVelocity.Z;

	// |d + v t| = speed * t, squared
	const time = smallestNonNegativeRoot(
		vx * vx + vy * vy + vz * vz - speed * speed,
		2 * (dx * vx + dy * vy + dz * vz),
		dx * dx + dy * dy + dz * dz,
	);
	if (time === undefined) {
		return undefined;
	}

	const position = new Vector3(
		targetPosition.X + vx * time,
		targetPosition.Y + vy * time,
		targetPosition.Z + vz * time,
	);
	const offset = position.sub(shooter);
	return {
		time,
		position,
		direction: offset.Magnitude > 0 ? offset.Unit : Vector3.zero,
	};
}

export function interceptBallistic(
	shooter: Vector3,
	speed: number,
	targetPosition: Vector3,
	targetVelocity: Vector3,
	gravity = DEFAULT_GRAVITY,
	arc: Arc = "low",
	tolerance = 1e-4,
): BallisticIntercept | undefined {
	const predicted = (time: number) => targetPosition.add(targetVelocity.mul(time));

	// find t where the flight time to the target's position at t equals t, with the secant method.
	// flight time changes smoothly with t, so this settles in a handful of iterations.
	let previousTime = 0;
	let previousError: number | undefined;
	let time = 0;

	for (let iteration = 0; iteration < 32; iteration++) {
		const solution = solveLaunch(shooter, predicted(time), speed, gravity, arc);
		if (solution === undefined) {
			return undefined;
		}

		const timeError = solution.time - time;
		if (math.abs(timeError) <= tolerance) {
			return { time: solution.time, position: predicted(time), velocity: solution.velocity };
		}

		let nextTime = time + timeError;
		if (previousError !== undefined && timeError !== previousError) {
			nextTime = time - (timeError * (time - previousTime)) / (timeError - previousError);
		}

		previousTime = time;
		previousError = timeError;
		time = math.max(0, nextTime);
	}

	return undefined;
}
