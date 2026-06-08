export interface ISecretManager {
    resolve(key: string, opts?: { flow?: string }): Promise<any>;
}
