export type BoardWriteRole = 'all' | 'user' | 'admin';

export interface BoardSetting {
    id: string; // notice, qna, review 등
    name: string;
    description: string;
    write_role: BoardWriteRole;
    created_at: string;
}
