import fs from "fs";
import path from "path";
import {installPackage, checkPackage} from "./dist/packages/views.mjs";
import World from "./dist/packages/world.mjs";
import {PACKAGE_AVAILABILITY_CODES} from "./common/constants.mjs";
import sessions from "./dist/sessions.mjs";

class PackageOperations {
	static async pHandleCheckPackage (req, res) {
		const out = {errors: []};

		const adminAuth = sessions.authenticateAdmin(req, res);
		if (!adminAuth.success) {
			res.status(403).json({error: `Not authenticated!`});
			return;
		}

		const checkResults = await checkPackage(req.body.manifest);

		if (checkResults.isDowngrade) out.errors.push(`Your currently-installed version of ${checkResults.title} is more recent!`);
		if (checkResults.availability !== PACKAGE_AVAILABILITY_CODES.AVAILABLE) out.errors.push(`${checkResults.title} is not compatible with your current installation! (Code ${checkResults.availability})`);

		const outPath = path.join(World.baseDir, checkResults.remote.id);
		if (fs.existsSync(outPath)) out.errors.push(`Target installation directory "${outPath}" already exists!`);

		res.send(out);
	}

	static async pHandleInstallPackage (req, res) {
		const adminAuth = sessions.authenticateAdmin(req, res);
		if (!adminAuth.success) {
			res.status(403).json({error: `Not authenticated!`});
			return;
		}

		const out = await installPackage(req.body.manifest);
		res.send(out);
	}
}

export default ({Plutonium}) => {
	Plutonium.MODULE_PACKAGE_OPERATIONS = PackageOperations;
};
