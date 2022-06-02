import * as admin from "firebase-admin";
import * as stagingServiceAccount from "../config/keys/minft-firebase-staging.json";

let config;

let ENV = "staging";

switch (ENV) {
  //   case "development":
  //     config = {
  //       projectId: devServiceAccount.project_id,
  //       credential: admin.credential.cert(devServiceAccount as admin.ServiceAccount),
  //     };
  //     break;

  case "staging":
    config = {
      projectId: stagingServiceAccount.project_id,
      credential: admin.credential.cert(
        stagingServiceAccount as admin.ServiceAccount
      ),
    };
    break;
  //   case "production":
  //     config = {
  //       projectId: productionServiceAccount.project_id,
  //       credential: admin.credential.cert(productionServiceAccount as admin.ServiceAccount),
  //     };
  //     break;
}

admin.initializeApp(config);

export default admin;
