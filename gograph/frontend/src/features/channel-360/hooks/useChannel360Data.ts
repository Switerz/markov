import { useParams } from "react-router-dom";
import { channel360Mock } from "../channel-360.mock";
import type { Channel360Data } from "../types";

// TODO(api): swap mock for a real endpoint that takes the slug and
// returns Channel360Data.
export function useChannel360Data(): Channel360Data {
  const { slug } = useParams<{ slug: string }>();
  // Currently the mock is always Google Ads — when more channels are
  // wired, dispatch on slug.
  void slug;
  return channel360Mock;
}
