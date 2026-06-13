interface AdminPaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  maxVisiblePages?: number;
}

export default function AdminPagination({
  currentPage,
  totalPages,
  onPageChange,
  maxVisiblePages = 5,
}: AdminPaginationProps) {
  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      onPageChange(page);
    }
  };

  const getVisiblePages = (): number[] => {
    if (totalPages <= maxVisiblePages) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const half = Math.floor(maxVisiblePages / 2);
    let start = currentPage - half;
    let end = currentPage + half;

    if (start < 1) {
      start = 1;
      end = maxVisiblePages;
    }

    if (end > totalPages) {
      end = totalPages;
      start = totalPages - maxVisiblePages + 1;
    }

    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  };

  const visiblePages = getVisiblePages();

  if (totalPages <= 1) {
    return null;
  }

  return (
    <div className="flex justify-center items-center mt-8 gap-2 sticky bottom-4 bg-white">
      <button
        onClick={() => handlePageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className={`w-8 h-8 flex items-center justify-center ${
          currentPage === 1 ? "text-[#E9E9E9] cursor-not-allowed" : "text-[#BFBFBF]"
        }`}
        data-testid="button-prev-page"
      >
        ‹
      </button>
      {visiblePages.map((page) => (
        <button
          key={page}
          onClick={() => handlePageChange(page)}
          className={`w-8 h-8 flex items-center justify-center ${
            currentPage === page ? "text-[#E11936] font-semibold" : "text-[#BFBFBF]"
          }`}
          data-testid={`button-page-${page}`}
        >
          {page}
        </button>
      ))}
      <button
        onClick={() => handlePageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className={`w-8 h-8 flex items-center justify-center ${
          currentPage === totalPages ? "text-[#E9E9E9] cursor-not-allowed" : "text-[#BFBFBF]"
        }`}
        data-testid="button-next-page"
      >
        ›
      </button>
    </div>
  );
}
