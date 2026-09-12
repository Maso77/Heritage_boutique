/**
 * HERITAGE — import reproductible du catalogue « WRIST PICS ».
 *
 * Source: ../WRIST PICS/HERITAGE_Catalogue_Montres.docx et ses dossiers
 * d'images. Ce script n'invente ni prix ni stock: les fiches sans prix
 * demeurent en brouillon et les autres sont publiées « Sur commande ».
 *
 * Prérequis: migrations Supabase du portail produits exécutées et .env local
 * contenant SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis dans .env.');
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const SOURCE_ROOT = path.resolve(process.cwd(), '..', 'WRIST PICS');
const BUCKET = 'heritage-media';
const ADMIN_EMAIL = 'heritageci15@gmail.com';

const watch = (data) => ({
  category: 'montres',
  brand: data.brand || 'Tissot',
  status: data.price ? 'published' : 'draft',
  stock_policy: 'on_order',
  stock_quantity: 0,
  low_stock_threshold: 2,
  ...data
});

// Les clés sont les libellés affichables dans l'éditeur de caractéristiques.
// Elles reprennent uniquement des données présentes dans le document source.
const CATALOGUE = [
  watch({
    name: 'Tissot Le Locle 20e Anniversaire — Cadran Argenté',
    slug: 'tissot-le-locle-20e-anniversaire-cadran-argente',
    sku: 'HRT-T0064071103303',
    reference: 'T006.407.11.033.03',
    folder: 'Tissot Le Locle',
    price: 550000,
    attributes: {
      'Modèle': 'Tissot Le Locle 20th Anniversary 39.3mm',
      'Diamètre': '39,3 mm', 'Boîtier': 'Acier inoxydable 316L', 'Verre': 'Saphir',
      'Fond de boîte': 'Transparent', 'Mouvement': 'Automatique', 'Réserve de marche': '80 h',
      'Bracelet': 'Bracelet à ouverture interchangeable'
    }
  }),
  watch({
    name: 'Tissot PR516 Classique — Référence 011',
    slug: 'tissot-pr516-classique-reference-011',
    sku: 'HRT-T1494171101100',
    reference: 'T149.417.11.011.00',
    folder: 'Tissot PR516 Classique — Référence 011',
    price: 330000,
    attributes: {
      'Modèle': 'Tissot PR 516 Chronograph 40mm', 'Diamètre': '40 mm',
      'Boîtier': 'Acier inoxydable 316L avec revêtement PVD', 'Verre': 'Saphir traité antireflet',
      'Fond de boîte': 'Gravé', 'Mouvement': 'Quartz', 'Bracelet': 'Bracelet'
    }
  }),
  watch({
    name: 'Tissot PR516 Classique — Référence 041',
    slug: 'tissot-pr516-classique-reference-041',
    sku: 'HRT-T1494171104100',
    reference: 'T149.417.11.041.00',
    folder: 'Tissot PR516 Classique — Référence 041',
    price: 330000,
    attributes: {
      'Modèle': 'Tissot PR 516 Chronograph 40mm', 'Diamètre': '40 mm',
      'Boîtier': 'Acier inoxydable 316L', 'Verre': 'Saphir traité antireflet',
      'Fond de boîte': 'Gravé', 'Mouvement': 'Quartz', 'Bracelet': 'Bracelet'
    }
  }),
  watch({
    name: 'Tissot PR100 Classique',
    slug: 'tissot-pr100-classique',
    sku: 'HRT-T1504101601100',
    reference: 'T150.410.16.011.00',
    folder: 'Tissot PR100 Classique',
    price: 198000,
    attributes: {
      'Modèle': 'Tissot PR 100 40mm', 'Diamètre': '40 mm', 'Boîtier': 'Acier inoxydable 316L',
      'Verre': 'Saphir', 'Mouvement': 'Quartz', 'Bracelet': 'Bracelet'
    }
  }),
  watch({
    name: 'Tissot Carson Premium Powermatic 80 — Édition Standard',
    slug: 'tissot-carson-premium-powermatic-80-edition-standard',
    sku: 'HRT-T1224073603100-STD',
    reference: 'T122.407.36.031.00',
    folder: 'Tissot Carson Premium Powermatic 80 — Édition Standard',
    price: 385000,
    attributes: {
      'Modèle': 'Tissot Carson Premium Powermatic 80 40mm', 'Diamètre': '40 mm',
      'Boîtier': 'Acier inoxydable 316L avec revêtement PVD', 'Verre': 'Saphir traité antireflet',
      'Fond de boîte': 'Transparent', 'Mouvement': 'Automatique Swiss Made Powermatic 80',
      'Réserve de marche': '80 h', 'Bracelet': 'Bracelet à ouverture interchangeable rapide'
    }
  }),
  watch({
    name: 'Tissot Carson Premium Powermatic 80 — Cadran Noir',
    slug: 'tissot-carson-premium-powermatic-80-cadran-noir',
    sku: 'HRT-T1224073603100-NOIR',
    // La référence fabricant est identique à l'édition standard alors que
    // la base impose une référence unique. Elle reste conservée ci-dessous.
    reference: null,
    source_reference: 'T122.407.36.031.00',
    folder: 'Tissot Carson Premium Powermatic 80 — Cadran Noir',
    price: 398000,
    attributes: {
      'Modèle': 'Tissot Carson Premium Powermatic 80 40mm', 'Référence fabricant': 'T122.407.36.031.00',
      'Cadran': 'Noir', 'Diamètre': '40 mm', 'Boîtier': 'Acier inoxydable 316L avec revêtement PVD',
      'Verre': 'Saphir traité antireflet', 'Fond de boîte': 'Transparent',
      'Mouvement': 'Automatique Swiss Made Powermatic 80', 'Réserve de marche': '80 h',
      'Bracelet': 'Bracelet à ouverture interchangeable rapide'
    }
  }),
  watch({
    name: 'Tissot Seastar 1000 — Quartz Classique',
    slug: 'tissot-seastar-1000-quartz-classique',
    sku: 'HRT-T1204103305100',
    reference: 'T120.410.33.051.00',
    folder: 'Tissot Seastar 1000 — Quartz Classique',
    price: 290000,
    attributes: {
      'Modèle': 'Tissot Seastar 1000 40mm', 'Diamètre': '40 mm',
      'Boîtier': 'Acier inoxydable 316L avec revêtement PVD', 'Verre': 'Saphir traité antireflet',
      'Couronne': 'Vissée', 'Fond de boîte': 'Vissé', 'Lunette': 'Tournante unidirectionnelle',
      'Mouvement': 'Quartz', 'Bracelet': 'Bracelet', 'Étanchéité': '30 bar'
    }
  }),
  watch({
    name: 'Tissot Seastar 1000 — Cadran Rouge Dégradé',
    slug: 'tissot-seastar-1000-cadran-rouge-degrade',
    sku: 'HRT-T1204103342100',
    reference: 'T1204103342100',
    folder: 'Tissot Seastar 1000 — Cadran Rouge Dégradé',
    price: 285000,
    attributes: {
      'Modèle': 'Tissot Seastar 1000 40mm', 'Cadran': 'Rouge dégradé', 'Diamètre': '40 mm',
      'Boîtier': 'Acier inoxydable 316L avec revêtement PVD', 'Verre': 'Saphir traité antireflet',
      'Couronne': 'Vissée', 'Fond de boîte': 'Vissé', 'Lunette': 'Tournante unidirectionnelle',
      'Mouvement': 'Quartz', 'Bracelet': 'Bracelet', 'Étanchéité': '30 bar'
    }
  }),
  watch({
    name: 'Tissot Seastar 1000 — Cadran Vert-Noir Dégradé (Plongée)',
    slug: 'tissot-seastar-1000-cadran-vert-noir-degrade-plongee',
    sku: 'HRT-T1204103309100',
    reference: 'T1204103309100',
    folder: 'Tissot Seastar 1000 — Cadran Vert-Noir Dégradé (Plongée)',
    price: null,
    attributes: {
      'Modèle': 'Tissot Seastar 1000', 'Cadran': 'Vert-noir dégradé avec chemin de fer des minutes',
      'Affichage': 'Analogique', 'Index': 'Luminescents', 'Date': 'À 6 h',
      'Boîtier': 'Acier inoxydable 316L avec traitement PVD noir', 'Diamètre': '40 mm',
      'Épaisseur': '10 mm', 'Lunette': 'Acier PVD noir, tournante unidirectionnelle',
      'Verre': 'Saphir', 'Couronne': 'Vissée', 'Fond de boîte': 'Plein vissé',
      'Mouvement': 'Quartz suisse ETA F06.412', 'Fonctions': 'Heures, minutes, secondes, date',
      'Bracelet': 'Acier PVD noir, 20 mm', 'Fermoir': 'Boucle déployante avec sécurité',
      'Étanchéité': '300 m / 30 bar', 'Origine': 'Swiss Made'
    }
  }),
  watch({
    name: 'Tissot Seastar 2000 Professionnelle',
    slug: 'tissot-seastar-2000-professionnelle',
    sku: 'HRT-SEASTAR-2000-PRO',
    reference: null,
    folder: 'Tissot Seastar 2000 Professionnelle',
    price: 800000,
    attributes: {
      'Modèle': 'Tissot Seastar 2000 46mm', 'Diamètre': '46 mm', 'Boîtier': 'Acier inoxydable 316L',
      'Lunette': 'Céramique, tournante unidirectionnelle', 'Verre': 'Saphir traité antireflet',
      'Couronne': 'Vissée', 'Fond de boîte': 'Transparent, vissé',
      'Mouvement': 'Automatique', 'Réserve de marche': '80 h', 'Bracelet': 'Bracelet'
    }
  }),
  watch({
    name: 'Tissot Chemin Des Tourelles — Édition Standard',
    slug: 'tissot-chemin-des-tourelles-edition-standard',
    sku: 'HRT-T1394072203800',
    reference: 'T139.407.22.038.00',
    folder: 'Tissot Chemin Des Tourelles — Édition Standard',
    price: 460000,
    attributes: {
      'Modèle': 'Tissot Chemin des Tourelles Powermatic 80 42mm', 'Diamètre': '42 mm',
      'Boîtier': 'Acier inoxydable 316L avec revêtement PVD', 'Verre': 'Saphir traité antireflet',
      'Fond de boîte': 'Transparent', 'Mouvement': 'Automatique Swiss Made Powermatic 80',
      'Réserve de marche': '80 h', 'Bracelet': 'Bracelet'
    }
  }),
  watch({
    name: 'Tissot Chemin Des Tourelles — Cadran Bleu Foncé',
    slug: 'tissot-chemin-des-tourelles-cadran-bleu-fonce',
    sku: 'HRT-T1394071104800',
    reference: 'T139.407.11.048.00',
    folder: 'Tissot Chemin Des Tourelles — Cadran Bleu Foncé',
    price: 460000,
    attributes: {
      'Modèle': 'Tissot Chemin des Tourelles Powermatic 80 42mm', 'Cadran': 'Bleu foncé',
      'Diamètre': '42 mm', 'Boîtier': 'Acier inoxydable 316L', 'Verre': 'Saphir traité antireflet',
      'Fond de boîte': 'Transparent', 'Mouvement': 'Automatique Swiss Made Powermatic 80',
      'Réserve de marche': '80 h', 'Bracelet': 'Bracelet'
    }
  }),
  watch({
    name: 'Timex Expedition Gallatin — Bracelet Noir',
    slug: 'timex-expedition-gallatin-bracelet-noir',
    sku: 'HRT-TW4B25500',
    reference: 'TW4B25500',
    brand: 'Timex',
    folder: 'Timex Expedition Gallatin — Bracelet Noir',
    price: null,
    attributes: {
      'Modèle': 'Timex Expedition Gallatin 44mm', 'Cadran': 'Noir', 'Diamètre': '44 mm',
      'Épaisseur': '11,5 mm', 'Boîtier': 'Résine noire', 'Lunette': 'Résine noire, fixe',
      'Verre': 'Minéral', 'Fond de boîte': 'Plein', 'Mouvement': 'Quartz',
      'Bracelet': 'Silicone noir, 22 mm', 'Fermoir': 'Ardillon', 'Étanchéité': '50 m / 5 bar',
      'Fonctions': 'Heures, minutes, secondes, date', 'Origine': 'Made in Philippines'
    }
  }),
  watch({
    name: 'Timex Expedition Gallatin — Bracelet Vert',
    slug: 'timex-expedition-gallatin-bracelet-vert',
    sku: 'HRT-TW4B25400',
    reference: 'TW4B25400',
    brand: 'Timex',
    folder: 'Timex Expedition Gallatin — Bracelet Vert',
    price: null,
    attributes: {
      'Modèle': 'Timex Expedition Gallatin 44mm', 'Cadran': 'Noir', 'Diamètre': '44 mm',
      'Épaisseur': '11,5 mm', 'Boîtier': 'Résine noire', 'Lunette': 'Résine noire, fixe',
      'Verre': 'Minéral', 'Fond de boîte': 'Plein', 'Mouvement': 'Quartz',
      'Bracelet': 'Silicone vert, 22 mm', 'Fermoir': 'Ardillon', 'Étanchéité': '50 m / 5 bar',
      'Fonctions': 'Heures, minutes, secondes, date', 'Origine': 'Made in Philippines'
    }
  }),
  watch({
    name: 'Timex Navi XL — Bracelet Tissu Beige',
    slug: 'timex-navi-xl-bracelet-tissu-beige',
    sku: 'HRT-TW2U90000',
    reference: 'TW2U90000',
    brand: 'Timex',
    folder: 'Timex Navi XL — Bracelet Tissu Beige',
    price: null,
    attributes: {
      'Modèle': 'Timex Navi XL 41mm', 'Cadran': 'Noir', 'Diamètre': '41 mm', 'Épaisseur': '12,5 mm',
      'Boîtier': 'Acier inoxydable argenté', 'Lunette': 'Acier inoxydable noire, tournante unidirectionnelle',
      'Verre': 'Minéral', 'Fond de boîte': 'Plein', 'Mouvement': 'Quartz',
      'Bracelet': 'Tissu beige, 20 mm', 'Fermoir': 'Ardillon', 'Étanchéité': '100 m / 10 bar',
      'Fonctions': 'Heures, minutes, secondes, date', 'Origine': 'Made in Philippines'
    }
  })
];

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
}

function shortDescription(item) {
  const model = item.attributes.Modèle ? `${item.attributes.Modèle}. ` : '';
  const movement = item.attributes.Mouvement ? `Mouvement : ${item.attributes.Mouvement}.` : '';
  return `${model}${movement}`.trim();
}

function detailedDescription(item) {
  const details = Object.entries(item.attributes)
    .map(([label, value]) => `<li><strong>${escapeHtml(label)} :</strong> ${escapeHtml(value)}</li>`)
    .join('');
  return `<p>${escapeHtml(shortDescription(item))}</p><ul>${details}</ul>`;
}

function mimeType(fileName) {
  const extension = path.extname(fileName).toLowerCase();
  if (extension === '.png') return 'image/png';
  if (extension === '.webp') return 'image/webp';
  if (extension === '.avif') return 'image/avif';
  return 'image/jpeg';
}

function imageExtension(fileName) {
  const extension = path.extname(fileName).toLowerCase();
  return extension === '.jpeg' ? 'jpg' : extension.slice(1);
}

function requireSuccess(error, action) {
  if (error) throw new Error(`${action} : ${error.message}`);
}

async function listImages(folder) {
  const entries = await fs.readdir(path.join(SOURCE_ROOT, folder), { withFileTypes: true });
  const images = entries
    .filter((entry) => entry.isFile() && /\.(jpe?g|png|webp|avif)$/i.test(entry.name))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, 'fr', { numeric: true, sensitivity: 'base' }));
  if (!images.length) throw new Error(`Aucune image trouvée dans « ${folder} ». `);
  return images;
}

async function findOrCreateProduct(item, adminId) {
  const { data: existing, error: lookupError } = await supabase
    .from('products')
    .select('id')
    .eq('slug', item.slug)
    .maybeSingle();
  requireSuccess(lookupError, `Recherche de ${item.name}`);

  const payload = {
    name: item.name,
    slug: item.slug,
    sku: item.sku,
    reference: item.reference,
    brand: item.brand,
    category: item.category,
    short_description: shortDescription(item),
    description_html: detailedDescription(item),
    purchase_price_xof: 0,
    regular_price_xof: item.price || 0,
    sale_price_xof: null,
    stock_quantity: item.stock_quantity,
    low_stock_threshold: item.low_stock_threshold,
    stock_policy: item.stock_policy,
    status: 'draft',
    primary_media_id: null,
    attributes: item.attributes,
    colors: [],
    faq: [],
    seo_title: `${item.name} | HERITAGE Abidjan`,
    seo_description: `Découvrez ${item.name}, disponible chez HERITAGE à Abidjan.`,
    price_xof: item.price || 0,
    stock_count: item.stock_quantity,
    stock_status: 'Sur commande',
    primary_image: '',
    value_story_title: null,
    value_story_text: null,
    provenance_summary: null,
    warranty_summary: null,
    delivery_summary: null,
    created_by: adminId
  };

  if (existing) {
    const { data, error } = await supabase.from('products').update(payload).eq('id', existing.id).select('id').single();
    requireSuccess(error, `Mise à jour de ${item.name}`);
    return data;
  }

  const { data, error } = await supabase.from('products').insert(payload).select('id').single();
  requireSuccess(error, `Création de ${item.name}`);
  return data;
}

async function attachGallery(productId, item, adminId) {
  const { error: unlinkAssetsError } = await supabase.from('media_assets').update({ product_id: null }).eq('product_id', productId);
  requireSuccess(unlinkAssetsError, `Dissociation des anciennes images de ${item.name}`);
  const { error: unlinkRelationsError } = await supabase.from('product_media').delete().eq('product_id', productId);
  requireSuccess(unlinkRelationsError, `Suppression des anciennes liaisons de ${item.name}`);

  const images = await listImages(item.folder);
  const mediaIds = [];

  for (const [index, fileName] of images.entries()) {
    const sourcePath = path.join(SOURCE_ROOT, item.folder, fileName);
    const contents = await fs.readFile(sourcePath);
    const extension = imageExtension(fileName);
    const storagePath = `catalogue-montres/${item.slug}/image-${index + 1}.${extension}`;
    const contentType = mimeType(fileName);

    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, contents, {
      contentType,
      upsert: true,
      cacheControl: '31536000'
    });
    requireSuccess(uploadError, `Téléversement de ${fileName}`);

    const { data: publicUrlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
    const mediaPayload = {
      bucket_path: storagePath,
      public_url: publicUrlData.publicUrl,
      file_name: fileName,
      mime_type: contentType,
      alt_text: `${item.name} — vue ${index + 1}`,
      size_bytes: contents.byteLength,
      product_id: productId,
      folder: 'produit',
      tags: ['catalogue-montres', 'montres', item.brand.toLowerCase()],
      sort_order: index,
      is_ai_generated: false,
      uploaded_by: adminId
    };

    const { data: existingMedia, error: mediaLookupError } = await supabase
      .from('media_assets')
      .select('id')
      .eq('bucket_path', storagePath)
      .maybeSingle();
    requireSuccess(mediaLookupError, `Recherche du média ${fileName}`);

    let asset;
    if (existingMedia) {
      const { data, error } = await supabase.from('media_assets').update(mediaPayload).eq('id', existingMedia.id).select('id').single();
      requireSuccess(error, `Mise à jour du média ${fileName}`);
      asset = data;
    } else {
      const { data, error } = await supabase.from('media_assets').insert(mediaPayload).select('id').single();
      requireSuccess(error, `Création du média ${fileName}`);
      asset = data;
    }
    mediaIds.push(asset.id);
  }

  const { error: linkError } = await supabase.from('product_media').insert(
    mediaIds.map((mediaId, position) => ({ product_id: productId, media_id: mediaId, position }))
  );
  requireSuccess(linkError, `Liaison de la galerie de ${item.name}`);
  return { mediaIds, images };
}

async function importOne(item, adminId) {
  const product = await findOrCreateProduct(item, adminId);
  const { mediaIds, images } = await attachGallery(product.id, item, adminId);
  const primaryStoragePath = `catalogue-montres/${item.slug}/image-1.${imageExtension(images[0])}`;
  const { data: primaryUrl } = supabase.storage.from(BUCKET).getPublicUrl(primaryStoragePath);
  const { error: publishError } = await supabase.from('products').update({
    primary_media_id: mediaIds[0],
    primary_image: primaryUrl.publicUrl,
    status: item.status
  }).eq('id', product.id);
  requireSuccess(publishError, `Finalisation de ${item.name}`);

  const { error: auditError } = await supabase.from('admin_audit_logs').insert({
    admin_id: adminId,
    action: 'catalogue_import',
    entity_type: 'product',
    entity_id: product.id,
    details: { source: 'WRIST PICS', name: item.name, images: images.length, status: item.status }
  });
  requireSuccess(auditError, `Journalisation de ${item.name}`);
  return { name: item.name, status: item.status, images: images.length };
}

async function main() {
  const { data: admin, error: adminError } = await supabase
    .from('profiles')
    .select('id, role, is_active')
    .eq('email', ADMIN_EMAIL)
    .maybeSingle();
  requireSuccess(adminError, 'Recherche du compte administrateur');
  if (!admin || admin.role !== 'admin' || !admin.is_active) {
    throw new Error(`Le compte ${ADMIN_EMAIL} doit être un administrateur actif.`);
  }

  const summary = [];
  const failures = [];
  for (const item of CATALOGUE) {
    try {
      const result = await importOne(item, admin.id);
      summary.push(result);
      console.log(`OK — ${result.name} (${result.status}, ${result.images} images)`);
    } catch (error) {
      failures.push({ name: item.name, error: error instanceof Error ? error.message : String(error) });
      console.error(`ÉCHEC — ${item.name}`);
    }
  }

  const { count: totalProducts, error: countProductsError } = await supabase
    .from('products').select('*', { count: 'exact', head: true }).in('slug', CATALOGUE.map((item) => item.slug));
  requireSuccess(countProductsError, 'Contrôle du nombre de produits');
  const { count: totalLinks, error: countLinksError } = await supabase
    .from('product_media').select('*', { count: 'exact', head: true }).in('product_id', await productIds());
  requireSuccess(countLinksError, 'Contrôle du nombre d’images liées');

  console.log(JSON.stringify({
    imported: summary.length,
    published: summary.filter((item) => item.status === 'published').length,
    drafts: summary.filter((item) => item.status === 'draft').length,
    products_in_database: totalProducts,
    linked_images: totalLinks,
    failures
  }, null, 2));
  if (failures.length) process.exitCode = 1;
}

async function productIds() {
  const { data, error } = await supabase.from('products').select('id').in('slug', CATALOGUE.map((item) => item.slug));
  requireSuccess(error, 'Lecture des identifiants produits');
  return (data || []).map((product) => product.id);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
