/// <reference types="@rbxts/testez/globals" />

import {
	apex,
	DEFAULT_GRAVITY,
	launchVelocityForTime,
	maxRange,
	positionAt,
	solveLaunch,
	velocityAt,
} from "../ballistics";
import { assertNear, assertVectorNear } from "./near";

export = () => {
	const origin = new Vector3(10, 5, -20);
	const speed = 250;

	describe("solveLaunch", () => {
		const targets = [
			new Vector3(150, 5, 40),
			new Vector3(60, 80, -10),
			new Vector3(-90, -60, 30),
			new Vector3(10, 55, -20),
			new Vector3(10, -40, -20),
		];

		it("lands both arcs on the target at the requested speed", () => {
			for (const target of targets) {
				for (const arc of ["low", "high"] as const) {
					const solution = solveLaunch(origin, target, speed, DEFAULT_GRAVITY, arc);
					expect(solution).to.be.ok();
					assertNear(solution!.velocity.Magnitude, speed, 1e-3, `${arc} speed`);
					assertVectorNear(positionAt(origin, solution!.velocity, solution!.time), target, 1e-2, arc);
				}
			}
		});

		it("gives the high arc a longer flight and a higher peak", () => {
			const target = new Vector3(150, 5, 40);
			const low = solveLaunch(origin, target, speed, DEFAULT_GRAVITY, "low")!;
			const high = solveLaunch(origin, target, speed, DEFAULT_GRAVITY, "high")!;

			expect(high.time > low.time).to.equal(true);
			expect(apex(origin, high.velocity).position.Y > apex(origin, low.velocity).position.Y).to.equal(true);
		});

		it("returns undefined when the target is out of reach", () => {
			const range = maxRange(speed);
			expect(solveLaunch(origin, origin.add(new Vector3(range * 1.01, 0, 0)), speed)).never.to.be.ok();
			expect(solveLaunch(origin, origin.add(new Vector3(0, 300, 0)), speed)).never.to.be.ok();
			expect(solveLaunch(origin, origin.add(new Vector3(range * 0.99, 0, 0)), speed)).to.be.ok();
		});

		it("rejects a zero speed and a target on top of the origin", () => {
			expect(solveLaunch(origin, new Vector3(50, 5, 0), 0)).never.to.be.ok();
			expect(solveLaunch(origin, origin, speed)).never.to.be.ok();
		});

		it("flies straight with no gravity", () => {
			const target = new Vector3(110, 25, 30);
			const solution = solveLaunch(origin, target, 100, Vector3.zero)!;

			assertVectorNear(solution.velocity.Unit, target.sub(origin).Unit, 1e-5);
			assertNear(solution.time, target.sub(origin).Magnitude / 100, 1e-6);
		});

		it("works for gravity pointing in any direction", () => {
			const sideways = new Vector3(80, 0, -40);
			const target = new Vector3(-60, 30, 90);
			for (const arc of ["low", "high"] as const) {
				const solution = solveLaunch(origin, target, speed, sideways, arc)!;
				assertVectorNear(positionAt(origin, solution.velocity, solution.time, sideways), target, 1e-2, arc);
			}
		});
	});

	describe("maxRange", () => {
		it("matches speed squared over gravity on flat ground", () => {
			assertNear(maxRange(100), (100 * 100) / 196.2, 1e-3);
		});

		it("reaches further when firing down from a height", () => {
			const height = 40;
			const range = maxRange(speed, DEFAULT_GRAVITY, height);
			const below = (distance: number) => origin.add(new Vector3(distance, -height, 0));

			expect(range > maxRange(speed)).to.equal(true);
			expect(solveLaunch(origin, below(range * 0.99), speed)).to.be.ok();
			expect(solveLaunch(origin, below(range * 1.01), speed)).never.to.be.ok();
		});

		it("is zero when the target is higher than the shot can climb", () => {
			expect(maxRange(50, DEFAULT_GRAVITY, -1000)).to.equal(0);
		});
	});

	describe("launchVelocityForTime", () => {
		it("arrives exactly at the given time", () => {
			const target = new Vector3(-200, 40, 75);
			const velocity = launchVelocityForTime(origin, target, 2.5);
			assertVectorNear(positionAt(origin, velocity, 2.5), target, 1e-3);
		});

		it("refuses a non-positive time", () => {
			expect(() => launchVelocityForTime(origin, Vector3.zero, 0)).to.throw("time must be positive");
		});
	});

	describe("trajectory", () => {
		it("has a velocity that is the derivative of the position", () => {
			const velocity = new Vector3(40, 90, -15);
			const step = 1e-3;
			const time = 0.75;
			const slope = positionAt(origin, velocity, time + step)
				.sub(positionAt(origin, velocity, time - step))
				.div(2 * step);
			assertVectorNear(velocityAt(velocity, time), slope, 1e-2);
		});

		it("finds the apex where vertical velocity reaches zero", () => {
			const velocity = new Vector3(30, 100, 0);
			const peak = apex(origin, velocity);

			assertNear(peak.time, 100 / 196.2, 1e-6);
			assertNear(peak.position.Y - origin.Y, (100 * 100) / (2 * 196.2), 1e-3);
			assertNear(velocityAt(velocity, peak.time).Y, 0, 1e-4);
		});

		it("puts the apex at the origin for a shot already falling", () => {
			const peak = apex(origin, new Vector3(5, -10, 0));
			expect(peak.time).to.equal(0);
			assertVectorNear(peak.position, origin, 1e-6);
		});
	});
};
