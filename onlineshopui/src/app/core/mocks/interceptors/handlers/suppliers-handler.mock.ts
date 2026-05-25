import { HttpResponse } from '@angular/common/http';
import { MOCK_SUPPLIERS } from '../../data/products.mock';

type SuppliersHandlerContext = {
    method: string;
    path: string;
};

export function handleSuppliersFeature(
    context: SuppliersHandlerContext
): HttpResponse<unknown> | null {
    const { method, path } = context;

    if (method === 'GET' && path === '/suppliers') {
        return new HttpResponse({
            status: 200,
            body: MOCK_SUPPLIERS
        });
    }

    if (method === 'GET' && path.match(/^\/suppliers\/[\w-]+$/)) {
        const id = path.split('/').pop()!;
        const supplier = MOCK_SUPPLIERS.find(s => s.id === id);

        if (!supplier) {
            return new HttpResponse({
                status: 404,
                statusText: 'Not Found',
                body: { message: 'Supplier not found' }
            });
        }

        return new HttpResponse({
            status: 200,
            body: supplier
        });
    }

    return null;
}
