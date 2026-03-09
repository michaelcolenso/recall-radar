import Link from "next/link";

export interface BreadcrumbItem {
  label: string;
  href: string;
}

interface VehicleBreadcrumbsProps {
  items: BreadcrumbItem[];
}

export function VehicleBreadcrumbs({ items }: VehicleBreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-gray-500">
      <ol className="flex flex-wrap items-center gap-1">
        {items.map((item, index) => (
          <li key={item.href} className="flex items-center gap-1">
            {index < items.length - 1 ? (
              <>
                <Link href={item.href} className="hover:text-gray-900 hover:underline">
                  {item.label}
                </Link>
                <span aria-hidden="true">/</span>
              </>
            ) : (
              <span className="text-gray-900 font-medium" aria-current="page">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
