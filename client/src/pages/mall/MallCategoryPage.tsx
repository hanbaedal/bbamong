import { useRoute } from "wouter";
import MallHome from "./MallHome";

export default function MallCategoryPage() {
  const [, params] = useRoute("/shop/category/:categoryId");
  const categoryId = parseInt(params?.categoryId ?? "", 10);
  if (isNaN(categoryId)) {
    return <p className="p-8 text-center text-neutral-500">잘못된 카테고리입니다.</p>;
  }
  return <MallHome categoryId={categoryId} />;
}
