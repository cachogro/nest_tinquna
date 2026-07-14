import { PersonaCi } from "../../entities/persona-ci.entity";

export interface PersonasPaginadas {
  data: PersonaCi[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}