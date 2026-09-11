/**
 * Creates a SQL seed from the former local catalogue and journal.
 *
 * Usage (in the project folder):
 *   npx tsx supabase/generate_legacy_seed.ts > supabase/20260911_legacy_seed.sql
 *
 * Run the resulting SQL file in Supabase only after both CMS migrations.
 * Product warranty, delivery and provenance claims deliberately stay NULL:
 * they must be revalidated in the admin portal before being displayed again.
 */
import { BLOG_ARTICLES } from '../src/data/blog';
import { PRODUCTS } from '../src/data/products';

const quote = (value: unknown) => {
  if (value === null || value === undefined) return 'null';
  return `'${String(value).replace(/'/g, "''")}'`;
};

const json = (value: unknown) => `${quote(JSON.stringify(value))}::jsonb`;
const html = (value: string) => `<p>${value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`;
const articleHtml = (article: (typeof BLOG_ARTICLES)[number]) => article.content
  .map((section) => `<h2>${section.heading.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</h2>${section.paragraphs.map(html).join('')}`)
  .join('');

const productRows = PRODUCTS.map((product) => `(
  ${quote(product.id)}, ${quote(product.name)}, ${quote(product.slug)}, ${quote(product.sku)}, ${quote(product.reference)}, ${quote(product.brand)},
  ${quote(product.category)}, ${quote(product.shortDescription)}, ${quote(html(product.valueStoryText))},
  0, ${Number(product.priceXOF)}, null, ${Number(product.stockCount)}, 2, 'published',
  ${quote(product.primaryImage)}, ${json(product.additionalImages)}, ${json(product.attributes)}, ${json([])}, ${json(product.faq)},
  ${quote(product.valueStoryTitle)}, ${quote(product.valueStoryText)}, null, null, null, 'standard'
)`).join(',\n');

const relatedProductId = (sku?: string) => PRODUCTS.find((product) => product.sku === sku)?.id || null;
const blogRows = BLOG_ARTICLES.map((article) => `(
  ${quote(article.title)}, ${quote(article.slug)}, ${quote(article.summary)}, ${quote(articleHtml(article))}, ${quote(article.coverImage)},
  'published', now(), ${quote(article.category)}, ${json([])}, ${json(relatedProductId(article.relatedPieceSku) ? [relatedProductId(article.relatedPieceSku)] : [])}
)`).join(',\n');

console.log(`-- Generated from src/data/products.ts and src/data/blog.ts.
-- Review the result before executing it in Supabase SQL Editor.
begin;

insert into public.products (
  id, name, slug, sku, reference, brand, category, short_description, description_html,
  purchase_price_xof, regular_price_xof, sale_price_xof, stock_quantity, low_stock_threshold, status,
  primary_image, gallery_images, attributes, colors, faq,
  value_story_title, value_story_text, provenance_summary, warranty_summary, delivery_summary, stock_policy
) values
${productRows}
on conflict (id) do update set
  name = excluded.name, slug = excluded.slug, sku = excluded.sku, reference = excluded.reference,
  brand = excluded.brand, category = excluded.category, short_description = excluded.short_description,
  description_html = excluded.description_html, regular_price_xof = excluded.regular_price_xof,
  stock_quantity = excluded.stock_quantity, status = excluded.status, primary_image = excluded.primary_image,
  gallery_images = excluded.gallery_images, attributes = excluded.attributes, colors = excluded.colors,
  faq = excluded.faq, value_story_title = excluded.value_story_title, value_story_text = excluded.value_story_text,
  provenance_summary = null, warranty_summary = null, delivery_summary = null, stock_policy = excluded.stock_policy;

insert into public.blog_posts (
  title, slug, excerpt, content_html, cover_image, status, published_at, category, tags, related_product_ids
) values
${blogRows}
on conflict (slug) do update set
  title = excluded.title, excerpt = excluded.excerpt, content_html = excluded.content_html,
  cover_image = excluded.cover_image, status = excluded.status, published_at = excluded.published_at,
  category = excluded.category, tags = excluded.tags, related_product_ids = excluded.related_product_ids;

-- Existing contact details are migrated from the former Contact page. Social
-- links and footer promises remain empty until they are validated in the CMS.
update public.site_settings set
  business_name = 'HERITAGE',
  email = 'contact@heritage-abidjan.ci',
  phone = '+225 07 07 18 15 60',
  whatsapp_phone = '+225 07 07 18 15 60',
  address = 'Maison HERITAGE · Yopougon, Abidjan, Côte d''Ivoire',
  hours = 'Lundi au Samedi : 09h00 – 19h00 (GMT)',
  social_links = '{}'::jsonb,
  footer_notices = '[]'::jsonb
where id = true;

commit;`);
