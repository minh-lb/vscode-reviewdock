import * as vscode from 'vscode';
import type { Connection } from '../../domain/models';
import { connectionLabel, statusLabel } from './treeItems';
import type { ConnectionService } from '../../application/connectionService';

export class ConnectionsTree implements vscode.TreeDataProvider<Connection> {
  private readonly changed = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this.changed.event;
  constructor(private readonly service: ConnectionService) {}
  refresh(): void {
    this.changed.fire();
  }
  getTreeItem(connection: Connection): vscode.TreeItem {
    const item = new vscode.TreeItem(
      connectionLabel(connection),
      vscode.TreeItemCollapsibleState.None,
    );
    item.contextValue = connection.enabled
      ? 'reviewdock.connection.enabled'
      : 'reviewdock.connection.disabled';
    item.description = connection.enabled
      ? (connection.accountName ?? statusLabel(connection.status))
      : 'Disabled';
    item.iconPath = new vscode.ThemeIcon(connection.provider === 'github' ? 'github' : 'git-merge');
    item.command = {
      command: 'reviewdock.manageConnections',
      title: 'Manage Connections',
      arguments: [connection],
    };
    return item;
  }
  getChildren(): Connection[] {
    return this.service.listConnections();
  }
  dispose(): void {
    this.changed.dispose();
  }
}
