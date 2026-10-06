export interface LogoutFlowDependencies {
  requestLogout: () => Promise<unknown>;
  clearAuthentication: () => void;
  replace: (path: string) => void;
}

export async function completeLogout(dependencies: LogoutFlowDependencies): Promise<void> {
  await dependencies.requestLogout();
  dependencies.clearAuthentication();
  dependencies.replace("/login");
}
