package com.medicheck.server.client.hira.dto;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.databind.DeserializationContext;
import com.fasterxml.jackson.databind.JsonDeserializer;
import com.fasterxml.jackson.databind.JsonNode;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

/**
 * 공공데이터포털 응답의 items: 배열 또는 items: { item: [...] } 형태 모두 처리.
 * ObjectMapper 는 JsonParser 가 가진 codec 을 그대로 사용해 전역 Jackson 설정을 따르게 한다.
 */
public class ItemsFlexibleDeserializer extends JsonDeserializer<List<HiraHospItem>> {

    @Override
    public List<HiraHospItem> deserialize(JsonParser p, DeserializationContext ctxt) throws IOException {
        // 파서에 설정된 codec(ObjectMapper)을 사용해 트리 변환
        var codec = p.getCodec();
        JsonNode node = codec.readTree(p);
        if (node == null || node.isNull()) return List.of();

        List<HiraHospItem> list = new ArrayList<>();

        if (node.isArray()) {
            for (JsonNode elem : node) {
                list.add(codec.treeToValue(elem, HiraHospItem.class));
            }
            return list;
        }

        if (node.isObject() && node.has("item")) {
            JsonNode itemNode = node.get("item");
            if (itemNode.isArray()) {
                for (JsonNode elem : itemNode) {
                    list.add(codec.treeToValue(elem, HiraHospItem.class));
                }
            } else {
                list.add(codec.treeToValue(itemNode, HiraHospItem.class));
            }
        }

        return list;
    }
}
