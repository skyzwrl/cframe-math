/// <reference types="@rbxts/testez/globals" />

import { DEFAULT_GRAVITY, positionAt } from "../ballistics";
import { interceptBallistic, interceptLinear } from "../intercept";
import { assertNear, assertVectorNear } from "./near";

export = () => {
	describe("interceptLinear", () => {
		it("meets a moving target", () => {
			const shooter = new Vector3(0, 3, 0);
			const target = new Vector3(200, 0, 50);
			const velocity = new Vector3(-10, 0, 30);
			const result = interceptLinear(shooter, 100, target, velocity)!;

			expect(result).to.be.ok();
			expect(result.time > 0).to.equal(true);
			assertVectorNear(
				shooter.add(result.direction.mul(100 * result.time)),
				target.add(velocity.mul(result.time)),
				1e-2,
			);
			assertVectorNear(result.position, target.add(velocity.mul(result.time)), 1e-3);
		});

		it("takes distance over speed for a stationary target", () => {
			const result = interceptLinear(Vector3.zero, 50, new Vector3(30, 40, 0), Vector3.zero)!;
			assertNear(result.time, 1, 1e-9);
			assertVectorNear(result.direction, new Vector3(0.6, 0.8, 0), 1e-6);
		});

		it("handles a target exactly as fast as the projectile", () => {
			const target = new Vector3(100, 0, 0);
			const velocity = new Vector3(-60, 80, 0);
			const result = interceptLinear(Vector3.zero, 100, target, velocity)!;

			expect(result).to.be.ok();
			assertNear(result.time, 100 / 120, 1e-9);
			assertVectorNear(result.direction.mul(100 * result.time), target.add(velocity.mul(result.time)), 1e-3);
		});

		it("gives up on a faster target running away", () => {
			expect(interceptLinear(Vector3.zero, 100, new Vector3(50, 0, 0), new Vector3(200, 0, 0))).never.to.be.ok();
		});

		it("reports an immediate hit when already on the target", () => {
			const result = interceptLinear(Vector3.one, 100, Vector3.one, new Vector3(5, 0, 0))!;
			expect(result.time).to.equal(0);
		});
	});

	describe("interceptBallistic", () => {
		const shooter = new Vector3(0, 10, 0);
		const target = new Vector3(180, 0, 40);
		const velocity = new Vector3(0, 0, -25);

		it("lands on where the target will be, on both arcs", () => {
			for (const arc of ["low", "high"] as const) {
				const result = interceptBallistic(shooter, 250, target, velocity, DEFAULT_GRAVITY, arc);
				expect(result).to.be.ok();

				const hit = positionAt(shooter, result!.velocity, result!.time);
				assertVectorNear(hit, target.add(velocity.mul(result!.time)), 2e-2, arc);
				assertNear(result!.velocity.Magnitude, 250, 1e-3, `${arc} speed`);
			}
		});

		it("leads a target moving across the line of fire", () => {
			const crossing = new Vector3(0, 0, 40);
			const result = interceptBallistic(shooter, 250, target, crossing)!;

			expect(result.position.Z > target.Z).to.equal(true);
			assertVectorNear(
				positionAt(shooter, result.velocity, result.time),
				target.add(crossing.mul(result.time)),
				2e-2,
			);
		});

		it("gives up when the target outruns the range", () => {
			expect(interceptBallistic(shooter, 120, target, new Vector3(300, 0, 0))).never.to.be.ok();
		});
	});
};
