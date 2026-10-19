/// <reference types="@rbxts/testez/globals" />

import {
	angleBetween,
	angleDelta,
	clampDirection,
	clampYawPitch,
	fromYawPitchRoll,
	lerpAngle,
	lookAlong,
	lookAt,
	mirror,
	rotateAround,
	rotationBetween,
	signedVectorAngle,
	swingTwist,
	toYawPitchRoll,
	vectorAngle,
} from "../orientation";
import { lcg, randomRotation, randomVector } from "./lcg";
import { assertNear, assertOrthonormal, assertRotationNear, assertVectorNear } from "./near";

export = () => {
	describe("lookAlong", () => {
		it("faces the direction with an upright frame", () => {
			const rng = lcg(1);
			for (let index = 0; index < 50; index++) {
				const direction = randomVector(rng, 10);
				const cframe = lookAlong(Vector3.one, direction);

				assertVectorNear(cframe.LookVector, direction.Unit, 1e-5);
				assertOrthonormal(cframe);
				expect(cframe.UpVector.Y >= 0).to.equal(true);
				expect(math.abs(cframe.RightVector.Y) < 1e-5).to.equal(true);
			}
		});

		it("still builds a valid frame looking straight up or down", () => {
			for (const direction of [Vector3.yAxis, Vector3.yAxis.mul(-3), new Vector3(0, 1, 1e-9)]) {
				const cframe = lookAlong(Vector3.zero, direction);
				assertVectorNear(cframe.LookVector, direction.Unit, 1e-5);
				assertOrthonormal(cframe);
			}
		});

		it("keeps the position and skips rotation for a zero direction", () => {
			const cframe = lookAlong(new Vector3(1, 2, 3), Vector3.zero);
			assertVectorNear(cframe.Position, new Vector3(1, 2, 3), 1e-6);
			assertRotationNear(cframe, CFrame.identity, 1e-6);
		});

		it("respects a custom up vector", () => {
			const cframe = lookAt(Vector3.zero, new Vector3(0, 0, -10), Vector3.xAxis);
			assertVectorNear(cframe.UpVector, Vector3.xAxis, 1e-5);
			assertVectorNear(cframe.LookVector, new Vector3(0, 0, -1), 1e-5);
		});
	});

	describe("rotationBetween", () => {
		it("turns one direction onto another", () => {
			const rng = lcg(2);
			for (let index = 0; index < 50; index++) {
				const from = randomVector(rng, 5);
				const to = randomVector(rng, 5);
				assertVectorNear(rotationBetween(from, to).mul(from.Unit), to.Unit, 1e-5);
			}
		});

		it("is the identity for parallel vectors and a half turn for opposite ones", () => {
			const direction = new Vector3(1, 2, 3);
			assertRotationNear(rotationBetween(direction, direction.mul(4)), CFrame.identity, 1e-6);
			assertVectorNear(
				rotationBetween(direction, direction.mul(-1)).mul(direction.Unit),
				direction.Unit.mul(-1),
				1e-5,
			);
		});
	});

	describe("swingTwist", () => {
		it("recomposes into the original rotation", () => {
			const rng = lcg(3);
			for (let index = 0; index < 50; index++) {
				const rotation = randomRotation(rng);
				const axis = randomVector(rng);
				const { swing, twist } = swingTwist(rotation, axis);

				assertRotationNear(swing.mul(twist), rotation, 1e-4);
				assertVectorNear(twist.mul(axis.Unit), axis.Unit, 1e-4, "twist moves the axis");
				assertRotationNear(swingTwist(swing, axis).twist, CFrame.identity, 1e-3, "swing still twists");
			}
		});

		it("splits a pure twist and a pure swing cleanly", () => {
			const twistOnly = CFrame.fromAxisAngle(Vector3.yAxis, 1.2);
			const pureTwist = swingTwist(twistOnly, Vector3.yAxis);
			assertRotationNear(pureTwist.swing, CFrame.identity, 1e-5);
			assertRotationNear(pureTwist.twist, twistOnly, 1e-5);

			const halfTurnSwing = CFrame.fromAxisAngle(Vector3.xAxis, math.pi);
			const pureSwing = swingTwist(halfTurnSwing, Vector3.yAxis);
			assertRotationNear(pureSwing.twist, CFrame.identity, 1e-5);
			assertRotationNear(pureSwing.swing, halfTurnSwing, 1e-5);
		});

		it("ignores the translation of the input", () => {
			const { swing, twist } = swingTwist(new CFrame(5, 6, 7).mul(CFrame.Angles(0.4, 0.2, 0)), Vector3.zAxis);
			assertVectorNear(swing.Position, Vector3.zero, 1e-6);
			assertVectorNear(twist.Position, Vector3.zero, 1e-6);
		});
	});

	describe("clampDirection", () => {
		const axis = new Vector3(0, 0, -1);
		const limit = math.rad(30);

		it("leaves directions inside the cone alone", () => {
			const inside = new Vector3(0.2, 0.1, -1).Unit;
			assertVectorNear(clampDirection(inside, axis, limit), inside, 1e-6);
		});

		it("pulls outside directions onto the cone edge, in the same plane", () => {
			const outside = new Vector3(1, 0.5, -0.3);
			const clamped = clampDirection(outside, axis, limit);

			assertNear(vectorAngle(clamped, axis), limit, 1e-5);
			assertNear(axis.Cross(outside).Unit.Dot(axis.Cross(clamped).Unit), 1, 1e-5);
		});

		it("still lands on the edge when pointing straight backwards", () => {
			assertNear(vectorAngle(clampDirection(axis.mul(-1), axis, limit), axis), limit, 1e-5);
		});
	});

	describe("clampYawPitch", () => {
		const base = new CFrame(0, 5, 0).mul(CFrame.Angles(0, 1, 0));
		const limits = { minYaw: math.rad(-45), maxYaw: math.rad(45), minPitch: math.rad(-10), maxPitch: math.rad(30) };
		const toWorld = (yaw: number, pitch: number) =>
			base.VectorToWorldSpace(
				new Vector3(-math.sin(yaw) * math.cos(pitch), math.sin(pitch), -math.cos(yaw) * math.cos(pitch)),
			);

		it("leaves aims within the limits untouched", () => {
			const aim = toWorld(math.rad(20), math.rad(10));
			assertVectorNear(clampYawPitch(aim, base, limits), aim, 1e-5);
		});

		it("clamps yaw and pitch separately, relative to the base", () => {
			assertVectorNear(clampYawPitch(toWorld(math.rad(80), 0), base, limits), toWorld(math.rad(45), 0), 1e-5);
			assertVectorNear(
				clampYawPitch(toWorld(math.rad(-20), math.rad(70)), base, limits),
				toWorld(math.rad(-20), math.rad(30)),
				1e-5,
			);
			assertVectorNear(
				clampYawPitch(toWorld(math.rad(170), math.rad(-50)), base, limits),
				toWorld(math.rad(45), math.rad(-10)),
				1e-5,
			);
		});
	});

	describe("rotateAround", () => {
		it("swings a frame around a pivot", () => {
			const pivot = new Vector3(5, 0, 0);
			const quarterTurn = CFrame.Angles(0, math.pi / 2, 0);
			const rotated = rotateAround(new CFrame(10, 0, 0), pivot, quarterTurn);

			assertVectorNear(rotated.Position, new Vector3(5, 0, -5), 1e-5);
			assertRotationNear(rotated, quarterTurn, 1e-5);
		});

		it("keeps the distance to the pivot", () => {
			const rng = lcg(4);
			const pivot = randomVector(rng, 20);
			const cframe = new CFrame(randomVector(rng, 20)).mul(randomRotation(rng));
			const rotated = rotateAround(cframe, pivot, randomRotation(rng));
			assertNear(rotated.Position.sub(pivot).Magnitude, cframe.Position.sub(pivot).Magnitude, 1e-4);
		});
	});

	describe("mirror", () => {
		it("flips yaw across the YZ plane", () => {
			const cframe = new CFrame(3, 1, 2).mul(CFrame.Angles(0, 0.7, 0));
			const mirrored = mirror(cframe, Vector3.zero, Vector3.xAxis);

			assertVectorNear(mirrored.Position, new Vector3(-3, 1, 2), 1e-6);
			assertRotationNear(mirrored, CFrame.Angles(0, -0.7, 0), 1e-5);
		});

		it("returns a proper rotation and undoes itself", () => {
			const rng = lcg(5);
			for (let index = 0; index < 25; index++) {
				const cframe = new CFrame(randomVector(rng, 30)).mul(randomRotation(rng));
				const planePoint = randomVector(rng, 10);
				const planeNormal = randomVector(rng);
				const mirrored = mirror(cframe, planePoint, planeNormal);

				assertOrthonormal(mirrored);
				assertNear(
					mirrored.Position.sub(planePoint).Dot(planeNormal.Unit),
					-cframe.Position.sub(planePoint).Dot(planeNormal.Unit),
					1e-3,
				);
				const restored = mirror(mirrored, planePoint, planeNormal);
				assertVectorNear(restored.Position, cframe.Position, 1e-3);
				assertRotationNear(restored, cframe, 1e-4);
			}
		});
	});

	describe("toYawPitchRoll", () => {
		it("recovers the angles that built the frame", () => {
			const rng = lcg(6);
			for (let index = 0; index < 50; index++) {
				const yaw = (rng() * 2 - 1) * 3;
				const pitch = (rng() * 2 - 1) * 1.4;
				const roll = (rng() * 2 - 1) * 3;
				const angles = toYawPitchRoll(fromYawPitchRoll(yaw, pitch, roll));

				assertNear(angles.yaw, yaw, 1e-4, "yaw");
				assertNear(angles.pitch, pitch, 1e-4, "pitch");
				assertNear(angles.roll, roll, 1e-4, "roll");
			}
		});

		it("stays finite and rebuilds the same rotation at and near the poles", () => {
			for (const pitch of [math.pi / 2, -math.pi / 2, math.pi / 2 - 1e-4, -math.pi / 2 + 1e-5]) {
				const original = fromYawPitchRoll(0.8, pitch, -0.6);
				const angles = toYawPitchRoll(original);

				expect(angles.yaw === angles.yaw && angles.roll === angles.roll).to.equal(true);
				assertRotationNear(fromYawPitchRoll(angles.yaw, angles.pitch, angles.roll), original, 1e-3);
			}
		});
	});

	describe("angles", () => {
		it("takes the short way around the wrap", () => {
			assertNear(angleDelta(math.rad(170), math.rad(-170)), math.rad(20), 1e-9);
			assertNear(angleDelta(math.rad(-170), math.rad(170)), math.rad(-20), 1e-9);
			assertNear(angleDelta(0, 4 * math.pi + 0.5), 0.5, 1e-9);
			assertNear(math.abs(angleDelta(lerpAngle(math.rad(170), math.rad(-170), 0.5), math.pi)), 0, 1e-9);
		});

		it("measures the angle between frames, small and large, ignoring position", () => {
			for (const angle of [1e-4, 0.3, 2, math.pi - 1e-3]) {
				const a = new CFrame(4, 5, 6).mul(CFrame.Angles(0.2, -0.4, 0.1));
				const b = new CFrame(-9, 0, 2)
					.mul(CFrame.Angles(0.2, -0.4, 0.1))
					.mul(CFrame.fromAxisAngle(new Vector3(1, 2, 2).Unit, angle));
				assertNear(angleBetween(a, b), angle, math.max(angle * 1e-3, 1e-5));
			}
		});

		it("signs vector angles by the axis", () => {
			assertNear(vectorAngle(Vector3.xAxis, Vector3.yAxis), math.pi / 2, 1e-6);
			assertNear(signedVectorAngle(Vector3.xAxis, Vector3.yAxis, Vector3.zAxis), math.pi / 2, 1e-6);
			assertNear(signedVectorAngle(Vector3.yAxis, Vector3.xAxis, Vector3.zAxis), -math.pi / 2, 1e-6);
		});
	});
};
