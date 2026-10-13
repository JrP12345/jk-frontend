export interface StaffWorkspace {
  organizationId: string;
  name: string;
  role: string;
}

export interface WorkspaceSelection {
  workspaceRequired: true;
  workspaceToken: string;
  workspaces: StaffWorkspace[];
}
