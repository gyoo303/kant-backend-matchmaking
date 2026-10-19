export interface Category {
    id: string;
    parent_id: string | null;
    name: string;
    depth: number;
    sort_order: number;
    children?: Category[];
}
