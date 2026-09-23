import React, { useMemo } from "react";
import { getFoodEmoji, DEFAULT_FOOD_EMOJI } from "@/lib/food-emoji";

export type FoodIconProps = {
  /** Nome ou descrição do alimento para detecção automática */
  name?: string | null;
  /** Emoji explícito fornecido diretamente (opcional, com validação de fallback) */
  emoji?: string | null;
  /** Classes CSS adicionais para o container/wrapper do ícone */
  className?: string;
  /** Classes CSS de tamanho/estilização da fonte do emoji (ex: 'text-2xl', 'text-4xl') */
  sizeClassName?: string;
  /** Label para acessibilidade (aria-label). Se omitido, usa name ou 'Alimento' */
  ariaLabel?: string;
};

/**
 * Regex para validar se uma string é ou contém um emoji válido
 */
const EMOJI_REGEX = /(\p{Extended_Pictographic}|\p{Emoji_Presentation})/u;

function isValidEmoji(val?: string | null): boolean {
  if (!val || typeof val !== "string") return false;
  const trimmed = val.trim();
  if (trimmed.length === 0) return false;
  return EMOJI_REGEX.test(trimmed);
}

/**
 * Componente `FoodIcon`
 * 
 * Encapsula a lógica completa de renderização de emojis de alimentos, bebidas e refeições.
 * Garante que:
 * 1. Se fornecido `emoji` e este for válido, ele é renderizado.
 * 2. Se fornecido `name`, busca o emoji semântico ideal através do `getFoodEmoji`.
 * 3. Se nenhum emoji válido for detectado (ou dado inválido/vazio vindo da API),
 *    o fallback seguro para o ícone padrão de prato e talheres (🍽️) é rigorosamente aplicado.
 */
export function FoodIcon({
  name,
  emoji,
  className = "",
  sizeClassName = "",
  ariaLabel,
}: FoodIconProps) {
  const resolvedEmoji = useMemo(() => {
    // 1. Se um emoji explícito foi passado e é válido, usa-o
    if (isValidEmoji(emoji)) {
      return emoji!.trim();
    }

    // 2. Se temos o nome do alimento, resolve via getFoodEmoji
    if (name && typeof name === "string" && name.trim().length > 0) {
      const resolved = getFoodEmoji(name);
      if (isValidEmoji(resolved)) {
        return resolved;
      }
    }

    // 3. Fallback consistente absoluto: Ícone padrão de prato com talheres
    return DEFAULT_FOOD_EMOJI;
  }, [name, emoji]);

  const label = ariaLabel || name || "Alimento";

  return (
    <span
      role="img"
      aria-label={label}
      className={`inline-flex items-center justify-center select-none leading-none drop-shadow-sm transition-transform ${sizeClassName} ${className}`.trim()}
    >
      {resolvedEmoji}
    </span>
  );
}

export default FoodIcon;
