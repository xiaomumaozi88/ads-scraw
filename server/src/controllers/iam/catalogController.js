import { buildIamCatalog } from '../../config/iamCatalog.js';
import { applyCatalogCors } from '../../utils/catalogCors.js';

export function getCatalog(req, res) {
  applyCatalogCors(req, res);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.status(200).json(buildIamCatalog());
}

export function optionsCatalog(req, res) {
  applyCatalogCors(req, res);
  res.sendStatus(204);
}
