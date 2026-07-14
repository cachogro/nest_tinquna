import { PersonaCi } from "../entities/persona-ci.entity";

export class PersonasPaginadasDto {
  data: PersonaCi[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}