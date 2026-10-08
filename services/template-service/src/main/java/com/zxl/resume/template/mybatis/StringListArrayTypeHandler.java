package com.zxl.resume.template.mybatis;

import org.apache.ibatis.type.BaseTypeHandler;
import org.apache.ibatis.type.JdbcType;
import org.apache.ibatis.type.MappedJdbcTypes;
import org.apache.ibatis.type.MappedTypes;

import java.sql.Array;
import java.sql.CallableStatement;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;

@MappedTypes(List.class)
@MappedJdbcTypes(JdbcType.ARRAY)
public class StringListArrayTypeHandler extends BaseTypeHandler<List<String>> {

    @Override
    public void setNonNullParameter(PreparedStatement ps, int index, List<String> value,
                                    JdbcType jdbcType) throws SQLException {
        ps.setArray(index, ps.getConnection().createArrayOf("text", value.toArray(new String[0])));
    }

    @Override
    public List<String> getNullableResult(ResultSet rs, String columnName) throws SQLException {
        return toList(rs.getArray(columnName));
    }

    @Override
    public List<String> getNullableResult(ResultSet rs, int columnIndex) throws SQLException {
        return toList(rs.getArray(columnIndex));
    }

    @Override
    public List<String> getNullableResult(CallableStatement cs, int columnIndex) throws SQLException {
        return toList(cs.getArray(columnIndex));
    }

    private List<String> toList(Array array) throws SQLException {
        if (array == null) {
            return null;
        }
        Object values = array.getArray();
        List<String> result = new ArrayList<>();
        if (values instanceof Object[] items) {
            for (Object item : items) {
                result.add(item == null ? null : item.toString());
            }
        }
        return result;
    }
}
